import { describe, expect, it } from "vitest";

import {
  normalizeEditedText,
  planQuestionContentEdit,
  type EditableQuestion,
  type QuestionContentEditInput,
} from "./question-content-edit";

const question: EditableQuestion = {
  type: "MULTIPLE_CHOICE",
  statement: "Qual é a capital do Brasil?",
  correctTrueFalse: null,
  answerKeyStatus: "DEFINED",
  alternatives: [
    { id: "a", label: "A", content: "Rio de Janeiro", isCorrect: false, mediaCount: 0 },
    { id: "b", label: "B", content: "Brasília", isCorrect: true, mediaCount: 0 },
    { id: "c", label: "C", content: "", isCorrect: false, mediaCount: 1 },
  ],
};

const baseInput: QuestionContentEditInput = {
  statement: question.statement,
  alternativeContents: { a: "Rio de Janeiro", b: "Brasília", c: "" },
  correctAlternativeId: "b",
  correctTrueFalse: null,
  reason: "Correção de digitação",
  confirmAnswerKeyChange: false,
  isPublished: false,
};

describe("planQuestionContentEdit", () => {
  it("reports no changes when nothing differs", () => {
    expect(planQuestionContentEdit(question, baseInput)).toEqual({ ok: false, error: "NO_CHANGES" });
  });

  it("plans a statement edit and keeps the answer key", () => {
    const result = planQuestionContentEdit(question, {
      ...baseInput,
      statement: "  Qual é a capital federal do Brasil?\r\n",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.changedFields).toEqual(["statement"]);
    expect(result.plan.answerKeyChanged).toBe(false);
    expect(result.plan.after.statement).toBe("Qual é a capital federal do Brasil?");
    expect(result.plan.alternativeUpdates).toEqual([]);
    expect(result.plan.before.statement).toBe(question.statement);
  });

  it("moves the correct alternative and records the key change", () => {
    const result = planQuestionContentEdit(question, { ...baseInput, correctAlternativeId: "a" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.changedFields).toEqual(["answerKey"]);
    expect(result.plan.answerKeyChanged).toBe(true);
    expect(result.plan.alternativeUpdates).toEqual([
      { id: "a", content: "Rio de Janeiro", isCorrect: true },
      { id: "b", content: "Brasília", isCorrect: false },
    ]);
  });

  it("requires confirmation to change the key of a published question", () => {
    const input = { ...baseInput, correctAlternativeId: "a", isPublished: true };

    expect(planQuestionContentEdit(question, input)).toEqual({
      ok: false,
      error: "ANSWER_KEY_CONFIRMATION_REQUIRED",
    });
    expect(planQuestionContentEdit(question, { ...input, confirmAnswerKeyChange: true }).ok).toBe(true);
  });

  it("allows an image-only alternative to stay without text", () => {
    const result = planQuestionContentEdit(question, {
      ...baseInput,
      alternativeContents: { ...baseInput.alternativeContents, a: "São Paulo" },
    });

    expect(result.ok).toBe(true);
  });

  it("rejects clearing the text of an alternative without image", () => {
    expect(
      planQuestionContentEdit(question, {
        ...baseInput,
        alternativeContents: { ...baseInput.alternativeContents, a: "   " },
      }),
    ).toEqual({ ok: false, error: "ALTERNATIVE_EMPTY" });
  });

  it("rejects alternatives that do not belong to the question", () => {
    expect(
      planQuestionContentEdit(question, {
        ...baseInput,
        alternativeContents: { ...baseInput.alternativeContents, z: "x" },
      }),
    ).toEqual({ ok: false, error: "UNKNOWN_ALTERNATIVE" });
    expect(planQuestionContentEdit(question, { ...baseInput, correctAlternativeId: "z" })).toEqual({
      ok: false,
      error: "UNKNOWN_ALTERNATIVE",
    });
  });

  it("requires a reason and a statement", () => {
    expect(planQuestionContentEdit(question, { ...baseInput, statement: "Outra", reason: " " })).toEqual({
      ok: false,
      error: "REASON_REQUIRED",
    });
    expect(planQuestionContentEdit(question, { ...baseInput, statement: " \n " })).toEqual({
      ok: false,
      error: "STATEMENT_REQUIRED",
    });
  });

  it("defines a missing key as DEFINED", () => {
    const missing: EditableQuestion = {
      ...question,
      answerKeyStatus: "MISSING",
      alternatives: question.alternatives.map((alternative) => ({ ...alternative, isCorrect: false })),
    };
    const result = planQuestionContentEdit(missing, baseInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.after.answerKeyStatus).toBe("DEFINED");
  });

  it("edits the answer of a true/false question", () => {
    const trueFalse: EditableQuestion = {
      type: "TRUE_FALSE",
      statement: "A Terra é plana.",
      correctTrueFalse: true,
      answerKeyStatus: "VERIFIED",
      alternatives: [],
    };
    const input = {
      ...baseInput,
      statement: trueFalse.statement,
      alternativeContents: {},
      correctAlternativeId: null,
    };

    expect(planQuestionContentEdit(trueFalse, { ...input, correctTrueFalse: null })).toEqual({
      ok: false,
      error: "TRUE_FALSE_ANSWER_REQUIRED",
    });

    const result = planQuestionContentEdit(trueFalse, { ...input, correctTrueFalse: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.after.correctTrueFalse).toBe(false);
    expect(result.plan.after.answerKeyStatus).toBe("VERIFIED");
  });
});

describe("normalizeEditedText", () => {
  it("normalizes line endings and trailing spaces", () => {
    expect(normalizeEditedText("  a  \r\nb\t\r\n\r\n")).toBe("a\nb");
  });
});
