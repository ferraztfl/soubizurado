export const QUESTION_TYPES = {
  MULTIPLE_CHOICE: "MULTIPLE_CHOICE",
  TRUE_FALSE: "TRUE_FALSE",
} as const;

export type QuestionType =
  (typeof QUESTION_TYPES)[keyof typeof QUESTION_TYPES];
