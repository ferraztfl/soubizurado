import type { QuestionType } from "./question-type";

/*
 * Manual edit of question content (statement, alternative texts and
 * answer key). Pure rules: the server action loads the question, calls
 * planQuestionContentEdit and persists the plan with a revision.
 *
 * Alternatives keep their ids, labels and positions: student attempts
 * reference them, so an edit never adds, removes or reorders them.
 */

export const STATEMENT_MAX_LENGTH = 20_000;
export const ALTERNATIVE_MAX_LENGTH = 5_000;
export const REASON_MIN_LENGTH = 3;
export const REASON_MAX_LENGTH = 500;

export type EditableAlternative = Readonly<{
  id: string;
  label: string;
  content: string;
  isCorrect: boolean;
  mediaCount: number;
}>;

export type EditableQuestion = Readonly<{
  type: QuestionType;
  statement: string;
  correctTrueFalse: boolean | null;
  answerKeyStatus: "MISSING" | "DEFINED" | "VERIFIED";
  alternatives: readonly EditableAlternative[];
}>;

export type QuestionContentEditInput = Readonly<{
  statement: string;
  /** Alternative id → new text. */
  alternativeContents: Readonly<Record<string, string>>;
  /** MULTIPLE_CHOICE: id of the correct alternative. */
  correctAlternativeId: string | null;
  /** TRUE_FALSE: selected answer. */
  correctTrueFalse: boolean | null;
  reason: string;
  /** Required when the answer key of a published question changes. */
  confirmAnswerKeyChange: boolean;
  isPublished: boolean;
}>;

export type QuestionContentEditError =
  | "STATEMENT_REQUIRED"
  | "STATEMENT_TOO_LONG"
  | "ALTERNATIVE_TOO_LONG"
  | "ALTERNATIVE_EMPTY"
  | "UNKNOWN_ALTERNATIVE"
  | "CORRECT_ALTERNATIVE_REQUIRED"
  | "TRUE_FALSE_ANSWER_REQUIRED"
  | "REASON_REQUIRED"
  | "REASON_TOO_LONG"
  | "ANSWER_KEY_CONFIRMATION_REQUIRED"
  | "NO_CHANGES";

export type QuestionContentSnapshot = Readonly<{
  statement: string;
  correctTrueFalse: boolean | null;
  answerKeyStatus: "MISSING" | "DEFINED" | "VERIFIED";
  alternatives: readonly Readonly<{
    id: string;
    label: string;
    content: string;
    isCorrect: boolean;
  }>[];
}>;

export type QuestionContentEditPlan = Readonly<{
  changedFields: readonly string[];
  answerKeyChanged: boolean;
  before: QuestionContentSnapshot;
  after: QuestionContentSnapshot;
  /** Only alternatives whose text or correctness changed. */
  alternativeUpdates: readonly Readonly<{
    id: string;
    content: string;
    isCorrect: boolean;
  }>[];
}>;

export type QuestionContentEditResult =
  | Readonly<{ ok: true; plan: QuestionContentEditPlan }>
  | Readonly<{ ok: false; error: QuestionContentEditError }>;

/** Line endings and trailing spaces are normalized; inner text is kept. */
export function normalizeEditedText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function snapshot(question: EditableQuestion): QuestionContentSnapshot {
  return {
    statement: question.statement,
    correctTrueFalse: question.correctTrueFalse,
    answerKeyStatus: question.answerKeyStatus,
    alternatives: question.alternatives.map((alternative) => ({
      id: alternative.id,
      label: alternative.label,
      content: alternative.content,
      isCorrect: alternative.isCorrect,
    })),
  };
}

function fail(error: QuestionContentEditError): QuestionContentEditResult {
  return { ok: false, error };
}

export function planQuestionContentEdit(
  question: EditableQuestion,
  input: QuestionContentEditInput,
): QuestionContentEditResult {
  const statement = normalizeEditedText(input.statement);
  const reason = input.reason.trim();

  if (!statement) {
    return fail("STATEMENT_REQUIRED");
  }

  if (statement.length > STATEMENT_MAX_LENGTH) {
    return fail("STATEMENT_TOO_LONG");
  }

  const knownIds = new Set(question.alternatives.map((alternative) => alternative.id));

  if (Object.keys(input.alternativeContents).some((id) => !knownIds.has(id))) {
    return fail("UNKNOWN_ALTERNATIVE");
  }

  const isMultipleChoice = question.type === "MULTIPLE_CHOICE";

  if (isMultipleChoice) {
    if (!input.correctAlternativeId) {
      return fail("CORRECT_ALTERNATIVE_REQUIRED");
    }

    if (!knownIds.has(input.correctAlternativeId)) {
      return fail("UNKNOWN_ALTERNATIVE");
    }
  } else if (input.correctTrueFalse === null) {
    return fail("TRUE_FALSE_ANSWER_REQUIRED");
  }

  const editedAlternatives = [];

  for (const alternative of question.alternatives) {
    const submitted = input.alternativeContents[alternative.id];
    const content =
      submitted === undefined ? alternative.content : normalizeEditedText(submitted);

    if (content.length > ALTERNATIVE_MAX_LENGTH) {
      return fail("ALTERNATIVE_TOO_LONG");
    }

    // An image-only alternative may stay without text.
    if (!content && alternative.mediaCount === 0) {
      return fail("ALTERNATIVE_EMPTY");
    }

    editedAlternatives.push({
      id: alternative.id,
      label: alternative.label,
      content,
      isCorrect: isMultipleChoice
        ? alternative.id === input.correctAlternativeId
        : alternative.isCorrect,
    });
  }

  const correctTrueFalse = isMultipleChoice ? question.correctTrueFalse : input.correctTrueFalse;

  const alternativeUpdates = editedAlternatives.filter((edited, index) => {
    const original = question.alternatives[index];
    return edited.content !== original.content || edited.isCorrect !== original.isCorrect;
  });

  const textChanged = editedAlternatives.some(
    (edited, index) => edited.content !== question.alternatives[index].content,
  );

  const answerKeyChanged = isMultipleChoice
    ? editedAlternatives.some(
        (edited, index) => edited.isCorrect !== question.alternatives[index].isCorrect,
      )
    : correctTrueFalse !== question.correctTrueFalse;

  const changedFields = [
    ...(statement !== question.statement ? ["statement"] : []),
    ...(textChanged ? ["alternatives"] : []),
    ...(answerKeyChanged ? ["answerKey"] : []),
  ];

  if (changedFields.length === 0) {
    return fail("NO_CHANGES");
  }

  if (reason.length < REASON_MIN_LENGTH) {
    return fail("REASON_REQUIRED");
  }

  if (reason.length > REASON_MAX_LENGTH) {
    return fail("REASON_TOO_LONG");
  }

  if (answerKeyChanged && input.isPublished && !input.confirmAnswerKeyChange) {
    return fail("ANSWER_KEY_CONFIRMATION_REQUIRED");
  }

  // Defining a missing key makes it DEFINED; an existing status is kept
  // (a published question stays VERIFIED: the admin is verifying it now).
  const answerKeyStatus =
    answerKeyChanged && question.answerKeyStatus === "MISSING"
      ? "DEFINED"
      : question.answerKeyStatus;

  return {
    ok: true,
    plan: {
      changedFields,
      answerKeyChanged,
      before: snapshot(question),
      after: {
        statement,
        correctTrueFalse,
        answerKeyStatus,
        alternatives: editedAlternatives,
      },
      alternativeUpdates: alternativeUpdates.map(({ id, content, isCorrect }) => ({
        id,
        content,
        isCorrect,
      })),
    },
  };
}
