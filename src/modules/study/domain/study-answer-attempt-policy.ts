import {
  QUESTION_TYPES,
  type QuestionType,
} from "../../question-bank/domain/question-type";

export const STUDY_ANSWER_ATTEMPT_ISSUES = {
  PROFILE_REQUIRED: "PROFILE_REQUIRED",
  QUESTION_REQUIRED: "QUESTION_REQUIRED",
  MULTIPLE_CHOICE_ALTERNATIVE_REQUIRED:
    "MULTIPLE_CHOICE_ALTERNATIVE_REQUIRED",
  MULTIPLE_CHOICE_BOOLEAN_NOT_ALLOWED:
    "MULTIPLE_CHOICE_BOOLEAN_NOT_ALLOWED",
  TRUE_FALSE_ALTERNATIVE_NOT_ALLOWED:
    "TRUE_FALSE_ALTERNATIVE_NOT_ALLOWED",
  TRUE_FALSE_VALUE_REQUIRED:
    "TRUE_FALSE_VALUE_REQUIRED",
  RESPONSE_TIME_INVALID: "RESPONSE_TIME_INVALID",
} as const;

export type StudyAnswerAttemptIssue =
  (typeof STUDY_ANSWER_ATTEMPT_ISSUES)[keyof typeof STUDY_ANSWER_ATTEMPT_ISSUES];

export type StudyAnswerAttemptCandidate = Readonly<{
  profileId: string;
  questionId: string;
  questionType: QuestionType;
  selectedAlternativeId: string | null;
  selectedTrueFalse: boolean | null;
  responseTimeMs: number | null;
}>;

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

function hasValidResponseTime(
  responseTimeMs: number | null,
): boolean {
  return (
    responseTimeMs === null ||
    (
      Number.isSafeInteger(responseTimeMs) &&
      responseTimeMs >= 0
    )
  );
}

export function validateStudyAnswerAttempt(
  candidate: StudyAnswerAttemptCandidate,
): StudyAnswerAttemptIssue[] {
  const issues: StudyAnswerAttemptIssue[] = [];

  if (!hasText(candidate.profileId)) {
    issues.push(
      STUDY_ANSWER_ATTEMPT_ISSUES.PROFILE_REQUIRED,
    );
  }

  if (!hasText(candidate.questionId)) {
    issues.push(
      STUDY_ANSWER_ATTEMPT_ISSUES.QUESTION_REQUIRED,
    );
  }

  if (
    candidate.questionType ===
    QUESTION_TYPES.MULTIPLE_CHOICE
  ) {
    if (
      candidate.selectedAlternativeId === null ||
      !hasText(candidate.selectedAlternativeId)
    ) {
      issues.push(
        STUDY_ANSWER_ATTEMPT_ISSUES
          .MULTIPLE_CHOICE_ALTERNATIVE_REQUIRED,
      );
    }

    if (candidate.selectedTrueFalse !== null) {
      issues.push(
        STUDY_ANSWER_ATTEMPT_ISSUES
          .MULTIPLE_CHOICE_BOOLEAN_NOT_ALLOWED,
      );
    }
  }

  if (
    candidate.questionType === QUESTION_TYPES.TRUE_FALSE
  ) {
    if (candidate.selectedAlternativeId !== null) {
      issues.push(
        STUDY_ANSWER_ATTEMPT_ISSUES
          .TRUE_FALSE_ALTERNATIVE_NOT_ALLOWED,
      );
    }

    if (candidate.selectedTrueFalse === null) {
      issues.push(
        STUDY_ANSWER_ATTEMPT_ISSUES
          .TRUE_FALSE_VALUE_REQUIRED,
      );
    }
  }

  if (!hasValidResponseTime(candidate.responseTimeMs)) {
    issues.push(
      STUDY_ANSWER_ATTEMPT_ISSUES
        .RESPONSE_TIME_INVALID,
    );
  }

  return issues;
}
