import { describe, expect, it } from "vitest";

import {
  ANSWER_KEY_STATUS_LABELS,
  CLASSIFICATION_STATUS_LABELS,
  formatConfidence,
  labelFor,
  QUESTION_STATUS_LABELS,
  QUESTION_TYPE_LABELS,
} from "./question-labels";

describe("question labels", () => {
  it("covers every Prisma enum value in Portuguese", () => {
    expect(Object.keys(QUESTION_STATUS_LABELS)).toEqual([
      "DRAFT",
      "IN_REVIEW",
      "PUBLISHED",
      "ARCHIVED",
    ]);
    expect(Object.keys(ANSWER_KEY_STATUS_LABELS)).toEqual([
      "MISSING",
      "DEFINED",
      "VERIFIED",
    ]);
    expect(Object.keys(QUESTION_TYPE_LABELS)).toEqual([
      "MULTIPLE_CHOICE",
      "TRUE_FALSE",
    ]);
    expect(Object.keys(CLASSIFICATION_STATUS_LABELS)).toEqual([
      "PENDING",
      "PROCESSING",
      "COMPLETED",
      "REVIEW_REQUIRED",
      "FAILED",
    ]);
  });

  it("never returns the raw value", () => {
    expect(labelFor(QUESTION_STATUS_LABELS, "IN_REVIEW").label).toBe("Em revisão");
    expect(labelFor(QUESTION_STATUS_LABELS, "SOMETHING_NEW").label).toBe("Desconhecido");
    expect(labelFor(ANSWER_KEY_STATUS_LABELS, null).label).toBe("Desconhecido");
  });
});

describe("formatConfidence", () => {
  it("formats decimals as clamped percentages", () => {
    expect(formatConfidence(0.8349)).toBe("83%");
    expect(formatConfidence("0.5")).toBe("50%");
    expect(formatConfidence(3)).toBe("100%");
    expect(formatConfidence(null)).toBeNull();
    expect(formatConfidence("abc")).toBeNull();
  });
});
