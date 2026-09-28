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

/** Short chip text: always says what is LEFT, never a bare "0/1" that reads like "0 answered". */
export function planChipLabel(plan: StudentPlan): string {
  if (plan.premium || plan.remaining === null) return "Premium";
  const who = plan.visitor ? "Visitante" : "Grátis";
  if (plan.remaining <= 0) return `${who} · limite de hoje atingido`;
  return `${who} · ${plan.remaining} ${plan.remaining === 1 ? "resposta restante" : "respostas restantes"} hoje`;
}

/** Sidebar sentence about today's free answers. */
export function planUsageText(plan: StudentPlan): string {
  if (plan.premium || plan.remaining === null || plan.limit === null) return "Questões e simulados ilimitados.";
  if (plan.visitor) {
    return plan.remaining > 0
      ? "Você tem 1 resposta grátis hoje. Crie sua conta para responder 10 por dia."
      : "Você já usou a resposta grátis de hoje. Crie sua conta grátis para responder 10 por dia.";
  }
  return plan.remaining > 0
    ? `Restam ${plan.remaining} de ${plan.limit} respostas grátis hoje.`
    : `Você usou as ${plan.limit} respostas grátis de hoje. Volte amanhã ou assine o Premium.`;
}
