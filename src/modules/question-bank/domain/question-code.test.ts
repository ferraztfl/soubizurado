import { describe, expect, it } from "vitest";

import { formatQuestionCode, parseQuestionCode, parseQuestionReference } from "./question-code";

describe("question code", () => {
  it("formats and parses the public code", () => {
    expect(formatQuestionCode(100001)).toBe("Q100001");
    expect(parseQuestionCode("Q100001")).toBe(100001);
    expect(parseQuestionCode(" q103147 ")).toBe(103147);
    expect(parseQuestionCode("100001")).toBe(100001);
    expect(parseQuestionCode("Q12")).toBeNull();
    expect(parseQuestionCode("direito")).toBeNull();
  });

  it("accepts a code or a UUID as a question reference", () => {
    expect(parseQuestionReference("Q100001")).toEqual({ kind: "code", publicNumber: 100001 });
    expect(parseQuestionReference("00D64E4D-D040-40A5-94BB-76F7BD99216D")).toEqual({
      kind: "id",
      id: "00d64e4d-d040-40a5-94bb-76f7bd99216d",
    });
    expect(parseQuestionReference("abc")).toEqual({ kind: "invalid" });
  });
});
