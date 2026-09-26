/*
 * Human-readable (pt-BR) labels and visual tones for question enums.
 * UI must render these instead of raw values like "IN_REVIEW".
 */

export type LabelTone = "neutral" | "info" | "success" | "warning" | "danger";

export type EnumLabel = Readonly<{
  label: string;
  tone: LabelTone;
}>;

export const QUESTION_STATUS_LABELS = {
  DRAFT: { label: "Rascunho", tone: "neutral" },
  IN_REVIEW: { label: "Em revisão", tone: "warning" },
  PUBLISHED: { label: "Publicada", tone: "success" },
  ARCHIVED: { label: "Arquivada", tone: "neutral" },
} as const satisfies Record<string, EnumLabel>;

export const ANSWER_KEY_STATUS_LABELS = {
  MISSING: { label: "Sem gabarito", tone: "danger" },
  DEFINED: { label: "Gabarito definido", tone: "info" },
  VERIFIED: { label: "Gabarito verificado", tone: "success" },
} as const satisfies Record<string, EnumLabel>;

export const QUESTION_TYPE_LABELS = {
  MULTIPLE_CHOICE: { label: "Múltipla escolha", tone: "neutral" },
  TRUE_FALSE: { label: "Certo ou errado", tone: "neutral" },
} as const satisfies Record<string, EnumLabel>;

export const CLASSIFICATION_STATUS_LABELS = {
  PENDING: { label: "Na fila", tone: "neutral" },
  PROCESSING: { label: "Processando", tone: "info" },
  COMPLETED: { label: "Alta confiança", tone: "success" },
  REVIEW_REQUIRED: { label: "Revisar com atenção", tone: "warning" },
  FAILED: { label: "Falhou", tone: "danger" },
} as const satisfies Record<string, EnumLabel>;

const UNKNOWN: EnumLabel = { label: "Desconhecido", tone: "neutral" };

/** Safe lookup that never leaks a raw enum value to the UI. */
export function labelFor<T extends Record<string, EnumLabel>>(
  labels: T,
  value: string | null | undefined,
): EnumLabel {
  return value && value in labels ? labels[value as keyof T]! : UNKNOWN;
}

export function formatConfidence(
  value: number | string | { toString(): string } | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value.toString());

  return Number.isFinite(numeric)
    ? `${Math.round(Math.min(1, Math.max(0, numeric)) * 100)}%`
    : null;
}
