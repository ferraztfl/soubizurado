/*
 * Validation of a question written by hand in the backoffice (original,
 * authored by the platform). The question is created in review; it is
 * published later through the publication policy, never here.
 */

export const NEW_QUESTION_LABELS = ["A", "B", "C", "D", "E"] as const;

const MAX_STATEMENT = 20_000;
const MAX_ALTERNATIVE = 4_000;
const MIN_ALTERNATIVES = 2;

export type NewQuestionError =
  | "STATEMENT_REQUIRED"
  | "STATEMENT_TOO_LONG"
  | "ALTERNATIVE_TOO_LONG"
  | "ALTERNATIVES_REQUIRED"
  | "ALTERNATIVE_GAP"
  | "CORRECT_ALTERNATIVE_REQUIRED"
  | "TRUE_FALSE_ANSWER_REQUIRED"
  | "DISCIPLINE_REQUIRED";

export type NewQuestionInput = Readonly<{
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE";
  statement: string;
  /** Texts by label (A–E); blank trailing ones are dropped. */
  alternatives: Readonly<Record<string, string>>;
  correctLabel: string | null;
  correctTrueFalse: boolean | null;
  disciplineId: string | null;
}>;

export type NewQuestionPlan = Readonly<{
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE";
  statement: string;
  alternatives: readonly Readonly<{ label: string; content: string; position: number; isCorrect: boolean }>[];
  correctTrueFalse: boolean | null;
}>;

export type NewQuestionResult =
  | Readonly<{ ok: true; plan: NewQuestionPlan }>
  | Readonly<{ ok: false; error: NewQuestionError }>;

const clean = (value: string) => value.replace(/\r\n/g, "\n").trim();

export function planNewQuestion(input: NewQuestionInput): NewQuestionResult {
  const statement = clean(input.statement);

  if (!statement) return { ok: false, error: "STATEMENT_REQUIRED" };
  if (statement.length > MAX_STATEMENT) return { ok: false, error: "STATEMENT_TOO_LONG" };
  if (!input.disciplineId) return { ok: false, error: "DISCIPLINE_REQUIRED" };

  if (input.type === "TRUE_FALSE") {
    if (input.correctTrueFalse === null) return { ok: false, error: "TRUE_FALSE_ANSWER_REQUIRED" };
    return { ok: true, plan: { type: "TRUE_FALSE", statement, alternatives: [], correctTrueFalse: input.correctTrueFalse } };
  }

  const texts = NEW_QUESTION_LABELS.map((label) => clean(input.alternatives[label] ?? ""));
  let count = texts.length;
  while (count > 0 && !texts[count - 1]) count -= 1;

  if (count < MIN_ALTERNATIVES) return { ok: false, error: "ALTERNATIVES_REQUIRED" };
  // "A, B, (blank), D": letters must be contiguous, as students see them.
  if (texts.slice(0, count).some((text) => !text)) return { ok: false, error: "ALTERNATIVE_GAP" };
  if (texts.some((text) => text.length > MAX_ALTERNATIVE)) return { ok: false, error: "ALTERNATIVE_TOO_LONG" };

  const labels = NEW_QUESTION_LABELS.slice(0, count);
  if (!input.correctLabel || !labels.includes(input.correctLabel as (typeof labels)[number])) {
    return { ok: false, error: "CORRECT_ALTERNATIVE_REQUIRED" };
  }

  return {
    ok: true,
    plan: {
      type: "MULTIPLE_CHOICE",
      statement,
      correctTrueFalse: null,
      alternatives: labels.map((label, position) => ({
        label,
        content: texts[position]!,
        position,
        isCorrect: label === input.correctLabel,
      })),
    },
  };
}
