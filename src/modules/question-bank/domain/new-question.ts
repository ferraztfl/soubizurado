/*
 * Validation of a question entered by hand in the backoffice: an original
 * question, or a question from an exam the reviewer chose (the exam must be
 * cited: catalog board, year, organization and position). The question is
 * created in review; it is published later through the publication policy.
 */

export const NEW_QUESTION_LABELS = ["A", "B", "C", "D", "E"] as const;
export const MAX_STATEMENT_IMAGES = 6;

const MAX_STATEMENT = 20_000;
const MAX_SUPPORT_TEXT = 20_000;
const MAX_ALTERNATIVE = 4_000;
const MIN_ALTERNATIVES = 2;
const MIN_YEAR = 1990;
const MAX_NAME = 180;

/** "[imagem 2]" in the statement places the 2nd uploaded image there. */
const IMAGE_TOKEN = /\[imagem\s+(\d{1,2})\]/gi;

export type NewQuestionError =
  | "STATEMENT_REQUIRED"
  | "STATEMENT_TOO_LONG"
  | "SUPPORT_TEXT_TOO_LONG"
  | "ALTERNATIVE_TOO_LONG"
  | "ALTERNATIVES_REQUIRED"
  | "ALTERNATIVE_GAP"
  | "CORRECT_ALTERNATIVE_REQUIRED"
  | "TRUE_FALSE_ANSWER_REQUIRED"
  | "DISCIPLINE_REQUIRED"
  | "TOO_MANY_IMAGES"
  | "IMAGE_TOKEN_UNKNOWN"
  | "EXAM_BOARD_REQUIRED"
  | "EXAM_YEAR_INVALID"
  | "EXAM_ORGANIZATION_REQUIRED"
  | "EXAM_POSITION_REQUIRED"
  | "EXAM_NAME_TOO_LONG";

export type NewQuestionExamInput = Readonly<{
  boardId: string | null;
  year: number | null;
  organization: string;
  careerPosition: string;
  questionNumber: string;
}>;

export type NewQuestionInput = Readonly<{
  kind: "ORIGINAL" | "EXAM";
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE";
  statement: string;
  supportText: string;
  /** Texts by label (A–E); blank trailing ones are dropped. */
  alternatives: Readonly<Record<string, string>>;
  /** Labels whose alternative has an uploaded image (image counts as content). */
  alternativesWithImage: ReadonlySet<string>;
  statementImageCount: number;
  correctLabel: string | null;
  correctTrueFalse: boolean | null;
  disciplineId: string | null;
  exam: NewQuestionExamInput | null;
  currentYear: number;
}>;

export type NewQuestionPlan = Readonly<{
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE";
  statement: string;
  supportText: string | null;
  alternatives: readonly Readonly<{ label: string; content: string; position: number; isCorrect: boolean }>[];
  correctTrueFalse: boolean | null;
  exam: Readonly<{
    boardId: string;
    year: number;
    organization: string;
    careerPosition: string;
    questionNumber: string | null;
  }> | null;
}>;

export type NewQuestionResult =
  | Readonly<{ ok: true; plan: NewQuestionPlan }>
  | Readonly<{ ok: false; error: NewQuestionError }>;

const clean = (value: string) => value.replace(/\r\n/g, "\n").trim();
const cleanName = (value: string) => value.replace(/\s+/g, " ").trim();

function planExam(input: NewQuestionInput): NewQuestionPlan["exam"] | NewQuestionError {
  if (input.kind === "ORIGINAL" || !input.exam) return null;

  const { exam } = input;
  const organization = cleanName(exam.organization);
  const careerPosition = cleanName(exam.careerPosition);

  if (!exam.boardId) return "EXAM_BOARD_REQUIRED";
  if (!exam.year || exam.year < MIN_YEAR || exam.year > input.currentYear) return "EXAM_YEAR_INVALID";
  if (!organization) return "EXAM_ORGANIZATION_REQUIRED";
  if (!careerPosition) return "EXAM_POSITION_REQUIRED";
  if (organization.length > MAX_NAME || careerPosition.length > MAX_NAME || exam.questionNumber.length > 20) {
    return "EXAM_NAME_TOO_LONG";
  }

  return {
    boardId: exam.boardId,
    year: exam.year,
    organization,
    careerPosition,
    questionNumber: cleanName(exam.questionNumber) || null,
  };
}

export function planNewQuestion(input: NewQuestionInput): NewQuestionResult {
  const statement = clean(input.statement);
  const supportText = clean(input.supportText);

  if (!statement) return { ok: false, error: "STATEMENT_REQUIRED" };
  if (statement.length > MAX_STATEMENT) return { ok: false, error: "STATEMENT_TOO_LONG" };
  if (supportText.length > MAX_SUPPORT_TEXT) return { ok: false, error: "SUPPORT_TEXT_TOO_LONG" };
  if (input.statementImageCount > MAX_STATEMENT_IMAGES) return { ok: false, error: "TOO_MANY_IMAGES" };

  for (const match of statement.matchAll(IMAGE_TOKEN)) {
    const index = Number(match[1]);
    if (index < 1 || index > input.statementImageCount) return { ok: false, error: "IMAGE_TOKEN_UNKNOWN" };
  }

  if (!input.disciplineId) return { ok: false, error: "DISCIPLINE_REQUIRED" };

  const exam = planExam(input);
  if (typeof exam === "string") return { ok: false, error: exam };

  if (input.type === "TRUE_FALSE") {
    if (input.correctTrueFalse === null) return { ok: false, error: "TRUE_FALSE_ANSWER_REQUIRED" };
    return {
      ok: true,
      plan: {
        type: "TRUE_FALSE",
        statement,
        supportText: supportText || null,
        alternatives: [],
        correctTrueFalse: input.correctTrueFalse,
        exam,
      },
    };
  }

  const texts = NEW_QUESTION_LABELS.map((label) => clean(input.alternatives[label] ?? ""));
  const filled = NEW_QUESTION_LABELS.map((label, index) => Boolean(texts[index]) || input.alternativesWithImage.has(label));
  let count = filled.length;
  while (count > 0 && !filled[count - 1]) count -= 1;

  if (count < MIN_ALTERNATIVES) return { ok: false, error: "ALTERNATIVES_REQUIRED" };
  // "A, B, (blank), D": letters must be contiguous, as students see them.
  if (filled.slice(0, count).some((value) => !value)) return { ok: false, error: "ALTERNATIVE_GAP" };
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
      supportText: supportText || null,
      correctTrueFalse: null,
      exam,
      alternatives: labels.map((label, position) => ({
        label,
        content: texts[position]!,
        position,
        isCorrect: label === input.correctLabel,
      })),
    },
  };
}

/**
 * Replaces "[imagem N]" by the N-th uploaded image ("media:<asset id>", the
 * format the question page renders for images linked to the question).
 */
export function placeStatementImages(statement: string, assetIds: readonly string[]): string {
  return statement.replace(IMAGE_TOKEN, (token, index: string) => {
    const assetId = assetIds[Number(index) - 1];
    return assetId ? `![Imagem ${index}](media:${assetId})` : token;
  });
}
