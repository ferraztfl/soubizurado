/*
 * A student's study goals (Perfil) and privacy choices (Configurações).
 * Pure validation; the row is written by the student's own server actions.
 */

export const DAILY_GOAL_OPTIONS = [5, 10, 20, 30, 50, 80, 100] as const;
export const DEFAULT_DAILY_GOAL = 20;
const MAX_DAILY_GOAL = 500;
const MAX_TARGET_EXAM = 180;
const MAX_YEARS_AHEAD = 5;

export type StudyPreferences = Readonly<{
  dailyGoal: number;
  targetExam: string | null;
  targetBoardId: string | null;
  /** YYYY-MM-DD. */
  targetExamDate: string | null;
  showInRanking: boolean;
}>;

export const DEFAULT_STUDY_PREFERENCES: StudyPreferences = {
  dailyGoal: DEFAULT_DAILY_GOAL,
  targetExam: null,
  targetBoardId: null,
  targetExamDate: null,
  showInRanking: true,
};

export type GoalsInput = Readonly<{
  dailyGoal: string;
  targetExam: string;
  targetBoardId: string | null;
  targetExamDate: string;
  /** YYYY-MM-DD, São Paulo. */
  today: string;
}>;

export type GoalsError = "DAILY_GOAL_INVALID" | "TARGET_EXAM_TOO_LONG" | "EXAM_DATE_INVALID";

export type GoalsResult =
  | Readonly<{ ok: true; goals: Omit<StudyPreferences, "showInRanking"> }>
  | Readonly<{ ok: false; error: GoalsError }>;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function planStudyGoals(input: GoalsInput): GoalsResult {
  const dailyGoal = Number(input.dailyGoal);
  const targetExam = input.targetExam.replace(/\s+/g, " ").trim();
  const date = input.targetExamDate.trim();

  if (!Number.isSafeInteger(dailyGoal) || dailyGoal < 1 || dailyGoal > MAX_DAILY_GOAL) {
    return { ok: false, error: "DAILY_GOAL_INVALID" };
  }

  if (targetExam.length > MAX_TARGET_EXAM) {
    return { ok: false, error: "TARGET_EXAM_TOO_LONG" };
  }

  if (date) {
    const maxYear = Number(input.today.slice(0, 4)) + MAX_YEARS_AHEAD;
    if (!DAY.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`)) || date < input.today || Number(date.slice(0, 4)) > maxYear) {
      return { ok: false, error: "EXAM_DATE_INVALID" };
    }
  }

  return {
    ok: true,
    goals: {
      dailyGoal,
      targetExam: targetExam || null,
      targetBoardId: input.targetBoardId,
      targetExamDate: date || null,
    },
  };
}

/** Whole days from `today` to the exam (0 on the day itself). */
export function daysUntil(examDate: string, today: string): number {
  return Math.round((Date.parse(`${examDate}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
}
