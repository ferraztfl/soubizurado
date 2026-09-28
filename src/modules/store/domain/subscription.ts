/*
 * Recurring Premium. The price lives here (server-side) — never taken from a
 * form. Access comes from each approved monthly charge: one period of
 * Premium per charge, with a few days of grace for the next charge to go
 * through. Cancelling stops future charges; paid time is kept.
 */

export const SUBSCRIPTION_PLANS = {
  PREMIUM_MONTHLY: {
    name: "Premium mensal",
    reason: "Sou Bizurado Premium — assinatura mensal",
    amountCents: 990,
    frequencyMonths: 1,
  },
} as const;

export type SubscriptionPlanKey = keyof typeof SUBSCRIPTION_PLANS;

export const DEFAULT_SUBSCRIPTION_PLAN: SubscriptionPlanKey = "PREMIUM_MONTHLY";

/** Days of access kept after a period ends, while the next charge is processed. */
export const SUBSCRIPTION_GRACE_DAYS = 3;

export function isSubscriptionPlanKey(value: string): value is SubscriptionPlanKey {
  return Object.hasOwn(SUBSCRIPTION_PLANS, value);
}

export type SubscriptionStatus = "PENDING" | "AUTHORIZED" | "PAUSED" | "CANCELLED";

/** Mercado Pago preapproval status → ours (unknown values stay PENDING). */
export function subscriptionStatusFromProvider(status: string): SubscriptionStatus {
  switch (status) {
    case "authorized":
      return "AUTHORIZED";
    case "paused":
      return "PAUSED";
    case "cancelled":
      return "CANCELLED";
    default:
      return "PENDING";
  }
}

export type SubscriptionChargeStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

/** Mercado Pago payment status of a recurring charge → ours. */
export function chargeStatusFromPayment(status: string | null | undefined): SubscriptionChargeStatus {
  switch (status) {
    case "approved":
      return "PAID";
    case "refunded":
    case "charged_back":
      return "REFUNDED";
    case "rejected":
    case "cancelled":
      return "FAILED";
    default:
      return "PENDING";
  }
}

/** Adds calendar months in UTC, clamping to the month's last day (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

/** Premium bought by one approved charge: from payment to one period later, plus the grace days. */
export function subscriptionPeriod(
  planKey: SubscriptionPlanKey,
  paidAt: Date,
): Readonly<{ startsAt: Date; endsAt: Date }> {
  const end = addMonths(paidAt, SUBSCRIPTION_PLANS[planKey].frequencyMonths);
  end.setUTCDate(end.getUTCDate() + SUBSCRIPTION_GRACE_DAYS);
  return { startsAt: paidAt, endsAt: end };
}

/** "R$ 0,33" — the monthly price split over 30 days, rounded up to the cent (shown as "só R$ 0,33 por dia"). */
export function pricePerDayCents(planKey: SubscriptionPlanKey): number {
  const plan = SUBSCRIPTION_PLANS[planKey];
  return Math.ceil(plan.amountCents / (30 * plan.frequencyMonths));
}
