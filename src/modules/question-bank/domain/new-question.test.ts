import { describe, expect, it } from "vitest";

import { planNewQuestion, type NewQuestionInput } from "./new-question";

const base: NewQuestionInput = {
  type: "MULTIPLE_CHOICE",
  statement: "  Qual é a capital do Brasil?  ",
  alternatives: { A: "Rio", B: "Brasília", C: "Salvador", D: " ", E: "" },
  correctLabel: "B",
  correctTrueFalse: null,
  disciplineId: "d1",
};

describe("planNewQuestion", () => {
  it("keeps contiguous alternatives, drops blank trailing ones and marks the answer", () => {
    const result = planNewQuestion(base);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.statement).toBe("Qual é a capital do Brasil?");
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

  it("true/false needs the answer and has no alternatives", () => {
    expect(planNewQuestion({ ...base, type: "TRUE_FALSE" })).toEqual({ ok: false, error: "TRUE_FALSE_ANSWER_REQUIRED" });

    const result = planNewQuestion({ ...base, type: "TRUE_FALSE", correctTrueFalse: false });
    expect(result.ok && result.plan.alternatives).toEqual([]);
    expect(result.ok && result.plan.correctTrueFalse).toBe(false);
  });
});
