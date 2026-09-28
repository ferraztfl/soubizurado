import { describe, expect, it } from "vitest";

import { placeStatementImages, planNewQuestion, type NewQuestionInput } from "./new-question";

const base: NewQuestionInput = {
  kind: "ORIGINAL",
  type: "MULTIPLE_CHOICE",
  statement: "  Qual é a capital do Brasil?  ",
  supportText: "",
  alternatives: { A: "Rio", B: "Brasília", C: "Salvador", D: " ", E: "" },
  alternativesWithImage: new Set(),
  statementImageCount: 0,
  correctLabel: "B",
  correctTrueFalse: null,
  disciplineId: "d1",
  exam: null,
  currentYear: 2026,
};

const exam = { boardId: "b1", year: 2024, organization: "  PM  PR ", careerPosition: "Soldado", questionNumber: "12" };

describe("planNewQuestion", () => {
  it("keeps contiguous alternatives, drops blank trailing ones and marks the answer", () => {
    const result = planNewQuestion(base);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.statement).toBe("Qual é a capital do Brasil?");
    expect(result.plan.exam).toBeNull();
    expect(result.plan.alternatives.map((alternative) => [alternative.label, alternative.isCorrect])).toEqual([
      ["A", false],
      ["B", true],
      ["C", false],
    ]);
  });

  it("rejects gaps, a missing answer, too few alternatives and a missing discipline", () => {
    expect(planNewQuestion({ ...base, alternatives: { A: "x", B: "", C: "y" } })).toEqual({ ok: false, error: "ALTERNATIVE_GAP" });
    expect(planNewQuestion({ ...base, correctLabel: "D" })).toEqual({ ok: false, error: "CORRECT_ALTERNATIVE_REQUIRED" });
    expect(planNewQuestion({ ...base, alternatives: { A: "só uma" }, correctLabel: "A" })).toEqual({
      ok: false,
      error: "ALTERNATIVES_REQUIRED",
    });
    expect(planNewQuestion({ ...base, disciplineId: null })).toEqual({ ok: false, error: "DISCIPLINE_REQUIRED" });
    expect(planNewQuestion({ ...base, statement: "   " })).toEqual({ ok: false, error: "STATEMENT_REQUIRED" });
  });

  it("an image counts as the alternative content", () => {
    const result = planNewQuestion({ ...base, alternatives: { A: "x", C: "y" }, alternativesWithImage: new Set(["B"]) });

    expect(result.ok && result.plan.alternatives.map((alternative) => [alternative.label, alternative.content])).toEqual([
      ["A", "x"],
      ["B", ""],
      ["C", "y"],
    ]);
  });

  it("image tokens must point to an uploaded image", () => {
    expect(planNewQuestion({ ...base, statement: "Veja [imagem 2]", statementImageCount: 1 })).toEqual({
      ok: false,
      error: "IMAGE_TOKEN_UNKNOWN",
    });
    expect(planNewQuestion({ ...base, statement: "Veja [imagem 1]", statementImageCount: 1 }).ok).toBe(true);
    expect(planNewQuestion({ ...base, statementImageCount: 7 })).toEqual({ ok: false, error: "TOO_MANY_IMAGES" });
  });

  it("an exam question cites a catalog board, a valid year, organization and position", () => {
    const result = planNewQuestion({ ...base, kind: "EXAM", exam });

    expect(result.ok && result.plan.exam).toEqual({
      boardId: "b1",
      year: 2024,
      organization: "PM PR",
      careerPosition: "Soldado",
      questionNumber: "12",
    });
    expect(planNewQuestion({ ...base, kind: "EXAM", exam: { ...exam, boardId: null } })).toEqual({
      ok: false,
      error: "EXAM_BOARD_REQUIRED",
    });
    expect(planNewQuestion({ ...base, kind: "EXAM", exam: { ...exam, year: 2030 } })).toEqual({
      ok: false,
      error: "EXAM_YEAR_INVALID",
    });
    expect(planNewQuestion({ ...base, kind: "EXAM", exam: { ...exam, organization: " " } })).toEqual({
      ok: false,
      error: "EXAM_ORGANIZATION_REQUIRED",
    });
  });

  it("true/false needs the answer and has no alternatives", () => {
    expect(planNewQuestion({ ...base, type: "TRUE_FALSE" })).toEqual({ ok: false, error: "TRUE_FALSE_ANSWER_REQUIRED" });

    const result = planNewQuestion({ ...base, type: "TRUE_FALSE", correctTrueFalse: false });
    expect(result.ok && result.plan.alternatives).toEqual([]);
    expect(result.ok && result.plan.correctTrueFalse).toBe(false);
  });
});

describe("placeStatementImages", () => {
  it("replaces tokens by linked media and keeps unknown ones", () => {
    expect(placeStatementImages("Antes [imagem 1] e [IMAGEM 2] e [imagem 3]", ["a1", "a2"])).toBe(
      "Antes ![Imagem 1](media:a1) e ![Imagem 2](media:a2) e [imagem 3]",
    );
  });
});
