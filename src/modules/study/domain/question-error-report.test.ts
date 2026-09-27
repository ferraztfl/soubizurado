import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { isQuestionErrorReason, QUESTION_ERROR_REASONS } from "./question-error-report";

describe("question error report reasons", () => {
  it("accepts only the known reasons", () => {
    expect(isQuestionErrorReason("WRONG_ANSWER_KEY")).toBe(true);
    expect(isQuestionErrorReason("toString")).toBe(false);
    expect(isQuestionErrorReason(42)).toBe(false);
  });

  it("matches the database CHECK constraint", () => {
    const migration = readFileSync(
      resolve("prisma/migrations/20260927120000_study_notes_and_question_reports/migration.sql"),
      "utf8",
    );
    const constraint = /"reason" IN \(([^)]+)\)/.exec(migration)?.[1] ?? "";
    const allowed = [...constraint.matchAll(/'([A-Z_]+)'/g)].map((match) => match[1]).sort();

    expect(allowed).toEqual(Object.keys(QUESTION_ERROR_REASONS).sort());
  });
});
