/** "Reportar erro" reasons; mirrored by a CHECK constraint in the database. */
export const QUESTION_ERROR_REASONS = {
  WRONG_ANSWER_KEY: "Gabarito errado",
  TYPO: "Erro de digitação ou formatação",
  MISSING_CONTENT: "Falta texto, imagem ou alternativa",
  WRONG_CLASSIFICATION: "Matéria ou assunto errado",
  OUTDATED: "Questão desatualizada (lei mudou)",
  OTHER: "Outro problema",
} as const;

export type QuestionErrorReason = keyof typeof QUESTION_ERROR_REASONS;

export const QUESTION_ERROR_REPORT_STATUSES = ["OPEN", "RESOLVED", "DISMISSED"] as const;
export type QuestionErrorReportStatus = (typeof QUESTION_ERROR_REPORT_STATUSES)[number];

export const QUESTION_NOTE_MAX_LENGTH = 2000;
export const QUESTION_ERROR_DETAILS_MAX_LENGTH = 1000;

export function isQuestionErrorReason(value: unknown): value is QuestionErrorReason {
  return typeof value === "string" && Object.hasOwn(QUESTION_ERROR_REASONS, value);
}
