import type { Prisma } from "@/generated/prisma/client";
import { grantPeriod, orderStatusFromPayment } from "@/modules/store/domain/store";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import { getPayment } from "./mercado-pago/mercado-pago-client";

/*
 * Applies a Mercado Pago payment to its order. Called by the webhook and by
 * the return page; both only pass a payment id — the payment itself is
 * always fetched from the API. Idempotent: the order moves PENDING → PAID
 * once (guarded update), so access is granted once; a refund revokes it.
 */

export type ProcessPaymentResult =
  | Readonly<{ kind: "UNKNOWN_ORDER" }>
  | Readonly<{ kind: "AMOUNT_MISMATCH"; orderId: string }>
  | Readonly<{ kind: "UPDATED"; orderId: string; status: string; granted: boolean }>;

/** Latest end of the profile's active premium ("unlimited" when one has no end). */
async function currentPremiumEnd(
  transaction: Prisma.TransactionClient,
  profileId: string,
  now: Date,
): Promise<Date | null | "unlimited"> {
  const active = await transaction.entitlement.findMany({
    where: {
      profileId,
      kind: "QUESTION_BANK",
      revokedAt: null,
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    select: { endsAt: true },
  });

  if (active.some((row) => row.endsAt === null)) return "unlimited";
  return active.reduce<Date | null>((latest, row) => (row.endsAt && (!latest || row.endsAt > latest) ? row.endsAt : latest), null);
}

export async function processMercadoPagoPayment(paymentId: string): Promise<ProcessPaymentResult> {
  const payment = await getPayment(paymentId);
  const orderId = payment.external_reference;
  const prisma = getPrismaClient();

  const order =
    orderId && /^[0-9a-f-]{36}$/i.test(orderId)
      ? await prisma.order.findUnique({
          where: { id: orderId },
          select: { id: true, profileId: true, status: true, amountCents: true, currency: true, offer: { select: { grants: true } } },
        })
      : null;

  if (!order) {
    return { kind: "UNKNOWN_ORDER" };
  }

  // The paid amount must be the order's price (a tampered preference must not buy access).
  const paidCents = Math.round(payment.transaction_amount * 100);
  if (paidCents !== order.amountCents || payment.currency_id !== order.currency) {
    await prisma.order.update({ where: { id: order.id }, data: { providerStatus: "amount_mismatch" } });
    return { kind: "AMOUNT_MISMATCH", orderId: order.id };
  }

  const status = orderStatusFromPayment(payment.status);
  const providerPaymentId = String(payment.id);
  const now = new Date();

  const granted = await prisma.$transaction(async (transaction) => {
    if (status === "PAID") {
      const paidAt = payment.date_approved ? new Date(payment.date_approved) : now;
      const moved = await transaction.order.updateMany({
        where: { id: order.id, status: { in: ["PENDING", "FAILED", "CANCELLED"] } },
        data: { status: "PAID", paidAt, providerPaymentId, providerStatus: payment.status },
      });

      if (moved.count !== 1) {
        return false; // already paid (webhook + return page, retries)
      }

      for (const grant of order.offer.grants) {
        if (grant.kind !== "QUESTION_BANK") continue; // courses: Phase 3

        const period = grantPeriod(grant.durationDays, paidAt, await currentPremiumEnd(transaction, order.profileId, now));
        await transaction.entitlement.create({
          data: {
            profileId: order.profileId,
            kind: "QUESTION_BANK",
            startsAt: period.startsAt,
            endsAt: period.endsAt,
            source: "ORDER",
            sourceId: order.id,
          },
        });
      }

      return true;
    }

    if (status === "REFUNDED") {
      await transaction.order.updateMany({
        where: { id: order.id, status: "PAID" },
        data: { status: "REFUNDED", providerStatus: payment.status },
      });
      await transaction.entitlement.updateMany({
        where: { source: "ORDER", sourceId: order.id, revokedAt: null },
        data: { revokedAt: now },
      });
      return false;
    }

    // FAILED / CANCELLED only close a pending order; PENDING just records the provider status.
    await transaction.order.updateMany({
      where: { id: order.id, status: "PENDING" },
      data: status === "PENDING" ? { providerStatus: payment.status } : { status, providerStatus: payment.status },
    });
    return false;
  });

  return { kind: "UPDATED", orderId: order.id, status, granted };
}
