/** What the student shell shows about the plan (computed server-side in the layout). */
export type StudentPlan = Readonly<{
  premium: boolean;
  /** Signed out (public question bank). */
  visitor?: boolean;
  /** Free answers left today; null = unlimited. */
  remaining: number | null;
  /** Daily free answers; null = unlimited. */
  limit: number | null;
}>;

export function planChipLabel(plan: StudentPlan): string {
  if (plan.premium) return "Premium";
  return `${plan.visitor ? "Visitante" : "Grátis"} · ${plan.remaining}/${plan.limit} hoje`;
}
