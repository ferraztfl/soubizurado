import {
  chargeStatusFromPayment,
  isSubscriptionPlanKey,
  subscriptionPeriod,
  subscriptionStatusFromProvider,
} from "@/modules/store/domain/subscription";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import {
  getAuthorizedPayment,
  getPayment,
  getPreapproval,
  searchAuthorizedPayments,
  type AuthorizedPayment,
} from "./mercado-pago/mercado-pago-client";

/*
 * Applies Mercado Pago subscription events. Webhooks and the return page
 * only pass ids; everything is read back from the API. Access is granted
 * per approved charge, once (guarded status update); a refund revokes that
 * charge's period. Cancelling never removes time already paid.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function findSubscription(preapprovalId: string, externalReference: string | null | undefined) {
  const prisma = getPrismaClient();
  const select = { id: true, profileId: true, planKey: true, amountCents: true, currency: true, providerSubscriptionId: true } as const;

  return (
    (await prisma.subscription.findUnique({ where: { providerSubscriptionId: preapprovalId }, select })) ??
    (externalReference && UUID.test(externalReference)
      ? await prisma.subscription.findFirst({
          where: { id: externalReference, OR: [{ providerSubscriptionId: null }, { providerSubscriptionId: preapprovalId }] },
          select,
        })
      : null)
  );
}

export type SyncSubscriptionResult =
  | Readonly<{ kind: "UNKNOWN" }>
  | Readonly<{ kind: "AMOUNT_MISMATCH"; subscriptionId: string }>
  | Readonly<{ kind: "UPDATED"; subscriptionId: string; status: string }>;

/** Reads a preapproval and records its status on our subscription. */
export async function syncMercadoPagoSubscription(preapprovalId: string): Promise<SyncSubscriptionResult> {
  const preapproval = await getPreapproval(preapprovalId);
  const subscription = await findSubscription(preapproval.id, preapproval.external_reference);
  if (!subscription) return { kind: "UNKNOWN" };

  const prisma = getPrismaClient();
  const amount = preapproval.auto_recurring?.transaction_amount;

  // The recurring amount must be our price (a tampered preapproval must not buy access).
  if (amount === undefined || Math.round(amount * 100) !== subscription.amountCents) {
    await prisma.subscription.update({ where: { id: subscription.id }, data: { providerStatus: "amount_mismatch" } });
    return { kind: "AMOUNT_MISMATCH", subscriptionId: subscription.id };
  }

  const status = subscriptionStatusFromProvider(preapproval.status);
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      providerSubscriptionId: preapproval.id,
      status,
      providerStatus: preapproval.status.slice(0, 40),
      nextChargeAt: preapproval.next_payment_date ? new Date(preapproval.next_payment_date) : null,
      ...(status === "CANCELLED" ? { cancelledAt: new Date() } : {}),
    },
  });

  return { kind: "UPDATED", subscriptionId: subscription.id, status };
}

export type ChargeResult =
  | Readonly<{ kind: "UNKNOWN" }>
  | Readonly<{ kind: "AMOUNT_MISMATCH"; subscriptionId: string }>
  | Readonly<{ kind: "UPDATED"; subscriptionId: string; status: string; granted: boolean }>;

async function applyCharge(charge: AuthorizedPayment): Promise<ChargeResult> {
  const prisma = getPrismaClient();
  const subscription = await findSubscription(charge.preapproval_id, null);
  if (!subscription || !isSubscriptionPlanKey(subscription.planKey)) return { kind: "UNKNOWN" };
  const planKey = subscription.planKey;

  // The payment itself is the source of truth for "paid" and for the amount.
  const paymentId = charge.payment?.id != null ? String(charge.payment.id) : null;
  const payment = paymentId && /^\d{1,20}$/.test(paymentId) ? await getPayment(paymentId) : null;
  const amountCents = Math.round((payment?.transaction_amount ?? charge.transaction_amount) * 100);
  const currency = payment?.currency_id ?? charge.currency_id;
  const providerPaymentId = String(charge.id);

  if (amountCents !== subscription.amountCents || currency !== subscription.currency) {
    await prisma.subscriptionPayment.upsert({
      where: { providerPaymentId },
      update: { providerStatus: "amount_mismatch" },
      create: { subscriptionId: subscription.id, providerPaymentId, paymentId, amountCents, status: "FAILED", providerStatus: "amount_mismatch" },
    });
    return { kind: "AMOUNT_MISMATCH", subscriptionId: subscription.id };
  }

  const status = chargeStatusFromPayment(payment?.status);
  const now = new Date();

  const granted = await prisma.$transaction(async (transaction) => {
    const row = await transaction.subscriptionPayment.upsert({
      where: { providerPaymentId },
      update: { paymentId, providerStatus: (payment?.status ?? charge.status).slice(0, 40) },
      create: {
        subscriptionId: subscription.id,
        providerPaymentId,
        paymentId,
        amountCents,
        providerStatus: (payment?.status ?? charge.status).slice(0, 40),
      },
      select: { id: true },
    });

    if (status === "PAID") {
      const paidAt = payment?.date_approved ? new Date(payment.date_approved) : now;
      const moved = await transaction.subscriptionPayment.updateMany({
        where: { id: row.id, status: { in: ["PENDING", "FAILED"] } },
        data: { status: "PAID", paidAt },
      });
      if (moved.count !== 1) return false; // already applied (webhook retries, return page)

      const period = subscriptionPeriod(planKey, paidAt);
      await transaction.entitlement.create({
        data: {
          profileId: subscription.profileId,
          kind: "QUESTION_BANK",
          startsAt: period.startsAt,
          endsAt: period.endsAt,
          source: "SUBSCRIPTION",
          sourceId: row.id,
          note: "Assinatura mensal",
        },
      });
      await transaction.subscription.updateMany({
        where: { id: subscription.id, status: "PENDING" },
        data: { status: "AUTHORIZED" },
      });
      return true;
    }

    if (status === "REFUNDED") {
      await transaction.subscriptionPayment.updateMany({ where: { id: row.id, status: "PAID" }, data: { status: "REFUNDED" } });
      await transaction.entitlement.updateMany({
        where: { source: "SUBSCRIPTION", sourceId: row.id, revokedAt: null },
        data: { revokedAt: now },
      });
      return false;
    }

    if (status === "FAILED") {
      await transaction.subscriptionPayment.updateMany({ where: { id: row.id, status: "PENDING" }, data: { status: "FAILED" } });
    }
    return false;
  });

  return { kind: "UPDATED", subscriptionId: subscription.id, status, granted };
}

/** Webhook "subscription_authorized_payment": one recurring charge. */
export async function processMercadoPagoCharge(authorizedPaymentId: string): Promise<ChargeResult> {
  return applyCharge(await getAuthorizedPayment(authorizedPaymentId));
}

/** Return page: status of the subscription and of its charges so far (the webhook may not have arrived yet). */
export async function refreshMercadoPagoSubscription(preapprovalId: string): Promise<SyncSubscriptionResult> {
  const result = await syncMercadoPagoSubscription(preapprovalId);
  if (result.kind !== "UPDATED") return result;

  try {
    for (const charge of await searchAuthorizedPayments(preapprovalId)) {
      await applyCharge(charge);
    }
  } catch {
    // The webhook will deliver the charges.
  }

  return result;
}
