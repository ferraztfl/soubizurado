/*
 * Guided study session ("Estudar"): a fixed list of questions answered one
 * by one with immediate feedback. Pure rules; persistence lives elsewhere.
 */

export const STUDY_SESSION_MODES = {
  NEW: "Questões novas",
  REVIEW: "Revisão dos erros",
  MIXED: "Misto (revisão + novas)",
} as const;

export type StudySessionMode = keyof typeof STUDY_SESSION_MODES;

export const STUDY_SESSION_SIZES = [5, 10, 20, 30] as const;

export function isStudySessionMode(value: string): value is StudySessionMode {
  return Object.hasOwn(STUDY_SESSION_MODES, value);
}

/** How many due reviews and how many new questions a session takes. */
export function splitSession(mode: StudySessionMode, size: number, dueReviews: number): { reviews: number; fresh: number } {
  if (mode === "REVIEW") return { reviews: Math.min(size, dueReviews), fresh: 0 };
  if (mode === "NEW") return { reviews: 0, fresh: size };

  const reviews = Math.min(dueReviews, Math.ceil(size / 2));
  return { reviews, fresh: size - reviews };
}

export type SessionQuestionResult = "correct" | "wrong" | "pending";

/** Position (0-based) of the first question still to answer, or null when all are done. */
export function firstPending(results: readonly SessionQuestionResult[]): number | null {
  const index = results.indexOf("pending");
  return index === -1 ? null : index;
}
