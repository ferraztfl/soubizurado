import {
  describe,
  expect,
  it,
} from "vitest";

import {
  QUESTION_TYPES,
} from "../../question-bank/domain/question-type";

import {
  STUDY_ANSWER_ATTEMPT_ISSUES,
  validateStudyAnswerAttempt,
} from "./study-answer-attempt-policy";

describe("validateStudyAnswerAttempt", () => {
  it("accepts a valid multiple-choice attempt", () => {
    const issues = validateStudyAnswerAttempt({
      profileId: "profile-1",
      questionId: "question-1",
      questionType: QUESTION_TYPES.MULTIPLE_CHOICE,
      selectedAlternativeId: "alternative-a",
      selectedTrueFalse: null,
      responseTimeMs: 3500,
    });

    expect(issues).toEqual([]);
  });

  it("accepts a valid True/False attempt", () => {
    const issues = validateStudyAnswerAttempt({
      profileId: "profile-1",
      questionId: "question-1",
      questionType: QUESTION_TYPES.TRUE_FALSE,
      selectedAlternativeId: null,
      selectedTrueFalse: false,
      responseTimeMs: null,
    });

    expect(issues).toEqual([]);
  });

  it("rejects an invalid answer shape", () => {
    const issues = validateStudyAnswerAttempt({
      profileId: "profile-1",
      questionId: "question-1",
      questionType: QUESTION_TYPES.MULTIPLE_CHOICE,
      selectedAlternativeId: null,
      selectedTrueFalse: true,
      responseTimeMs: 10,
    });

    expect(issues).toEqual([
      STUDY_ANSWER_ATTEMPT_ISSUES
        .MULTIPLE_CHOICE_ALTERNATIVE_REQUIRED,
      STUDY_ANSWER_ATTEMPT_ISSUES
        .MULTIPLE_CHOICE_BOOLEAN_NOT_ALLOWED,
    ]);
  });

  it("rejects missing identifiers and invalid response time", () => {
    const issues = validateStudyAnswerAttempt({
      profileId: "   ",
      questionId: "",
      questionType: QUESTION_TYPES.TRUE_FALSE,
      selectedAlternativeId: "alternative-a",
      selectedTrueFalse: null,
      responseTimeMs: -1,
    });

    expect(issues).toEqual([
      STUDY_ANSWER_ATTEMPT_ISSUES.PROFILE_REQUIRED,
      STUDY_ANSWER_ATTEMPT_ISSUES.QUESTION_REQUIRED,
      STUDY_ANSWER_ATTEMPT_ISSUES
        .TRUE_FALSE_ALTERNATIVE_NOT_ALLOWED,
      STUDY_ANSWER_ATTEMPT_ISSUES
        .TRUE_FALSE_VALUE_REQUIRED,
      STUDY_ANSWER_ATTEMPT_ISSUES
        .RESPONSE_TIME_INVALID,
    ]);
  });
});
