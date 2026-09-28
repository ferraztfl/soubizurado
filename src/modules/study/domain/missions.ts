/*
 * Daily and weekly missions, computed from what the student already did
 * (answers, reviews, sessions, simulations) — nothing to claim or store.
 * Days and weeks follow São Paulo time; weeks start on Monday.
 */

export type MissionProgressInput = Readonly<{
  dailyGoal: number;
  today: Readonly<{ attempts: number; correct: number }>;
  dueReviews: number;
  week: Readonly<{
    attempts: number;
    correct: number;
    activeDays: number;
    finishedSessions: number;
    finishedSimulations: number;
  }>;
}>;

export type Mission = Readonly<{
  id: string;
  period: "daily" | "weekly";
  title: string;
  description: string;
  current: number;
  target: number;
  done: boolean;
  /** Where to go to make progress. */
  href: string;
}>;

const WEEKLY_ACCURACY = 70;
const WEEKLY_ACCURACY_MIN_ANSWERS = 30;
const WEEKLY_ACTIVE_DAYS = 5;
const WEEKLY_SESSIONS = 3;

function mission(input: Omit<Mission, "done" | "current"> & { current: number }): Mission {
  const current = Math.max(0, Math.min(input.current, input.target));
  return { ...input, current, done: current >= input.target };
}

export function buildMissions(input: MissionProgressInput): Mission[] {
  const correctTarget = Math.max(1, Math.ceil(input.dailyGoal * 0.6));
  const weeklyRate = input.week.attempts === 0 ? 0 : Math.round((input.week.correct / input.week.attempts) * 100);
  const enoughAnswers = input.week.attempts >= WEEKLY_ACCURACY_MIN_ANSWERS;

  return [
    mission({
      id: "daily-goal",
      period: "daily",
      title: `Responder ${input.dailyGoal} questões`,
      description: "Sua meta diária (ajuste no Perfil).",
      current: input.today.attempts,
      target: input.dailyGoal,
      href: "/app/estudar",
    }),
    mission({
      id: "daily-correct",
      period: "daily",
      title: `Acertar ${correctTarget} questões`,
      description: "60% da sua meta diária, com respostas certas.",
      current: input.today.correct,
      target: correctTarget,
      href: "/app/estudar",
    }),
    mission({
      id: "daily-reviews",
      period: "daily",
      title: "Revisões em dia",
      description:
        input.dueReviews === 0 ? "Nenhuma revisão vencida. Tudo em dia!" : `${input.dueReviews} questões erradas esperando revisão.`,
      // Done when nothing is due; progress shows how many are left.
      current: input.dueReviews === 0 ? 1 : 0,
      target: 1,
      href: "/app/estudar",
    }),
    mission({
      id: "weekly-days",
      period: "weekly",
      title: `Estudar em ${WEEKLY_ACTIVE_DAYS} dias da semana`,
      description: "Constância vale mais que maratona.",
      current: input.week.activeDays,
      target: WEEKLY_ACTIVE_DAYS,
      href: "/app/estudar",
    }),
    mission({
      id: "weekly-accuracy",
      period: "weekly",
      title: `${WEEKLY_ACCURACY}% de acerto na semana`,
      description: enoughAnswers
        ? `Você está com ${weeklyRate}% em ${input.week.attempts} respostas.`
        : `Responda pelo menos ${WEEKLY_ACCURACY_MIN_ANSWERS} questões na semana (${input.week.attempts} até agora).`,
      current: enoughAnswers ? weeklyRate : 0,
      target: WEEKLY_ACCURACY,
      href: "/app/desempenho",
    }),
    mission({
      id: "weekly-sessions",
      period: "weekly",
      title: `Concluir ${WEEKLY_SESSIONS} sessões de estudo`,
      description: "Sessões guiadas no Estudar.",
      current: input.week.finishedSessions,
      target: WEEKLY_SESSIONS,
      href: "/app/estudar",
    }),
    mission({
      id: "weekly-simulation",
      period: "weekly",
      title: "Concluir 1 simulado",
      description: "Treine no ritmo da prova.",
      current: input.week.finishedSimulations,
      target: 1,
      href: "/app/simulados",
    }),
  ];
}
