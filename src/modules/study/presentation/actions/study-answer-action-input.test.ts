import {
  describe,
  expect,
  it,
} from "vitest";

import {
  parseStudyAnswerActionInput,
} from "./study-answer-action-input";

describe("parseStudyAnswerActionInput", () => {
  it("accepts a normalized multiple-choice answer", () => {
    expect(
      parseStudyAnswerActionInput({
        questionId:
          " 550e8400-e29b-41d4-a716-446655440000 ",
        answer: {
          type: "MULTIPLE_CHOICE",
          alternativeId:
            " 550e8400-e29b-41d4-a716-446655440001 ",
        },
        responseTimeMs: 12500,
      }),
    ).toEqual({
      questionId:
        "550e8400-e29b-41d4-a716-446655440000",
      answer: {
        type: "MULTIPLE_CHOICE",
        alternativeId:
          "550e8400-e29b-41d4-a716-446655440001",
      },
      responseTimeMs: 12500,
    });
  });

  it("accepts a True/False answer", () => {
    expect(
      parseStudyAnswerActionInput({
        questionId:
          "550e8400-e29b-41d4-a716-446655440000",
        answer: {
          type: "TRUE_FALSE",
          value: false,
        },
      }),
    ).toEqual({
      questionId:
        "550e8400-e29b-41d4-a716-446655440000",
      answer: {
        type: "TRUE_FALSE",
        value: false,
      },
    });
  });

  it("rejects malformed answer payloads", () => {
    expect(
      parseStudyAnswerActionInput({
        questionId: "",
        answer: {
          type: "MULTIPLE_CHOICE",
          alternativeId: "",
        },
      }),
    ).toBeNull();

    expect(
      parseStudyAnswerActionInput({
        questionId:
          "550e8400-e29b-41d4-a716-446655440000",
        answer: {
          type: "TRUE_FALSE",
          value: "false",
        },
      }),
    ).toBeNull();

    expect(
      parseStudyAnswerActionInput({
        questionId:
          "550e8400-e29b-41d4-a716-446655440000",
        answer: {
          type: "TRUE_FALSE",
          value: true,
        },
        responseTimeMs: -1,
      }),
    ).toBeNull();
  });
});
