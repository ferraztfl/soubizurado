/*
 * What plan the student really has, in words. The question bank is unlimited
 * for administrators and for anyone with an active QUESTION_BANK entitlement
 * (a purchase, a combo, the monthly or the yearly Premium); the courses open
 * with ALL_COURSES (Premium) or a COURSE entitlement.
 */

export type PlanTier = "ADMIN" | "PREMIUM" | "FREE";

export type PlanSummaryInput = Readonly<{
  isAdmin: boolean;
  /** End of the latest active QUESTION_BANK entitlement: a date, null = no end, undefined = none active. */
  questionBankEnds: Date | null | undefined;
  /** Same for ALL_COURSES. */
  allCoursesEnds: Date | null | undefined;
  /** Status of the monthly subscription, when there is one. */
  subscriptionStatus: string | null;
  nextChargeAt: Date | null;
  dailyFreeAnswers: number;
}>;

export type PlanSummary = Readonly<{
  tier: PlanTier;
  badge: string;
  title: string;
  detail: string;
  /** Short facts for the tiles: questions, courses, renewal. */
  questions: string;
  courses: string;
  renewal: string;
}>;

const date = (value: Date) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(value);

export function describePlan(input: PlanSummaryInput): PlanSummary {
  const premium = input.questionBankEnds !== undefined;
  const until = input.questionBankEnds ? date(input.questionBankEnds) : null;
  const renews = input.subscriptionStatus === "AUTHORIZED";

  if (input.isAdmin) {
    return {
      tier: "ADMIN",
      badge: "Administrador",
      title: "Acesso total",
      detail: "Sua conta de administrador tem tudo liberado: questões e simulados ilimitados e todos os cursos. Nada precisa ser comprado.",
      questions: "Ilimitadas",
      courses: "Todos os cursos",
      renewal: "Não se aplica",
    };
  }

  if (premium) {
    return {
      tier: "PREMIUM",
      badge: "Premium",
      title: input.questionBankEnds === null ? "Premium sem prazo" : `Premium até ${until}`,
      detail: renews
        ? `Renovação automática${input.nextChargeAt ? ` — próxima cobrança em ${date(input.nextChargeAt)}` : ""}. Você pode cancelar quando quiser.`
        : "Sem renovação automática. Novas compras somam tempo ao seu Premium.",
      questions: "Ilimitadas",
      courses: input.allCoursesEnds !== undefined ? "Todos os cursos" : "Os cursos que você comprou",
      renewal: renews ? "Automática" : input.questionBankEnds === null ? "Sem vencimento" : `Vence em ${until}`,
    };
  }

  return {
    tier: "FREE",
    badge: "Gratuito",
    title: "Plano gratuito",
    detail: `${input.dailyFreeAnswers} respostas grátis por dia. Com o Premium, questões e simulados são ilimitados e todos os cursos ficam liberados.`,
    questions: `${input.dailyFreeAnswers} por dia`,
    courses: "Somente aulas grátis",
    renewal: "—",
  };
}
