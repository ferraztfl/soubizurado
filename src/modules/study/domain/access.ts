/*
 * Freemium access to answering questions. Daily limits (São Paulo day):
 * a visitor answers 1 question, a signed-in free student 10, a premium
 * student has no limit. Enforced server-side before an answer is graded.
 */

export const FREE_DAILY_ANSWERS = {
  visitor: 1,
  free: 10,
} as const;

export type AccessPlan = "visitor" | "free" | "premium";

export type AnswerAllowance = Readonly<{
  plan: AccessPlan;
  /** null = unlimited. */
  limit: number | null;
  used: number;
  /** null = unlimited. */
  remaining: number | null;
  canAnswer: boolean;
}>;

export function answerAllowance(plan: AccessPlan, usedToday: number): AnswerAllowance {
  if (plan === "premium") {
    return { plan, limit: null, used: usedToday, remaining: null, canAnswer: true };
  }

  const limit = FREE_DAILY_ANSWERS[plan];
  const remaining = Math.max(0, limit - usedToday);

  return { plan, limit, used: usedToday, remaining, canAnswer: remaining > 0 };
}

export type EntitlementPeriod = Readonly<{ startsAt: Date; endsAt: Date | null; revokedAt: Date | null }>;

export function isEntitlementActive(entitlement: EntitlementPeriod, now: Date): boolean {
  return (
    entitlement.revokedAt === null &&
    entitlement.startsAt.getTime() <= now.getTime() &&
    (entitlement.endsAt === null || entitlement.endsAt.getTime() > now.getTime())
  );
}

export function limitReachedMessage(allowance: AnswerAllowance): string {
  return allowance.plan === "visitor"
    ? "Você já respondeu a questão gratuita de hoje. Crie sua conta grátis para responder 10 questões por dia."
    : `Você usou suas ${allowance.limit} respostas gratuitas de hoje — elas renovam à meia-noite. Com o Premium (R$ 9,90/mês), as respostas são ilimitadas.`;
}
