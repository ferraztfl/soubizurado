import {
  QUESTION_TYPES,
  type QuestionType,
} from "./question-type";

export const QUESTION_PUBLICATION_ISSUES = {
  STATEMENT_REQUIRED: "STATEMENT_REQUIRED",
  SOURCE_REQUIRED: "SOURCE_REQUIRED",
  DISCIPLINE_REQUIRED: "DISCIPLINE_REQUIRED",
  TOPIC_REQUIRED: "TOPIC_REQUIRED",
  ALTERNATIVE_CONTENT_REQUIRED: "ALTERNATIVE_CONTENT_REQUIRED",
  MULTIPLE_CHOICE_ALTERNATIVES_REQUIRED:
    "MULTIPLE_CHOICE_ALTERNATIVES_REQUIRED",
  MULTIPLE_CHOICE_SINGLE_CORRECT_REQUIRED:
    "MULTIPLE_CHOICE_SINGLE_CORRECT_REQUIRED",
  MULTIPLE_CHOICE_BOOLEAN_ANSWER_NOT_ALLOWED:
    "MULTIPLE_CHOICE_BOOLEAN_ANSWER_NOT_ALLOWED",
  TRUE_FALSE_ALTERNATIVES_NOT_ALLOWED:
    "TRUE_FALSE_ALTERNATIVES_NOT_ALLOWED",
  TRUE_FALSE_ANSWER_REQUIRED:
    "TRUE_FALSE_ANSWER_REQUIRED",
} as const;

export type QuestionPublicationIssue =
  (typeof QUESTION_PUBLICATION_ISSUES)[keyof typeof QUESTION_PUBLICATION_ISSUES];

export type PublicationAlternative = Readonly<{
  content: string;
  isCorrect: boolean;
}>;

export type QuestionPublicationCandidate = Readonly<{
  type: QuestionType;
  statement: string;
  sourceId: string | null;
  disciplineId: string | null;
  topicId: string | null;
  correctTrueFalse: boolean | null;
  alternatives: readonly PublicationAlternative[];
}>;

function hasText(value: string | null): boolean {
  return value !== null && value.trim().length > 0;
}

export function validateQuestionForPublication(
  candidate: QuestionPublicationCandidate,
): QuestionPublicationIssue[] {
  const issues: QuestionPublicationIssue[] = [];

  if (!hasText(candidate.statement)) {
    issues.push(
      QUESTION_PUBLICATION_ISSUES.STATEMENT_REQUIRED,
    );
  }

  if (!hasText(candidate.sourceId)) {
    issues.push(
      QUESTION_PUBLICATION_ISSUES.SOURCE_REQUIRED,
    );
  }

  if (!hasText(candidate.disciplineId)) {
    issues.push(
      QUESTION_PUBLICATION_ISSUES.DISCIPLINE_REQUIRED,
    );
  }

  if (!hasText(candidate.topicId)) {
    issues.push(
      QUESTION_PUBLICATION_ISSUES.TOPIC_REQUIRED,
    );
  }

  if (
    candidate.alternatives.some(
      (alternative) =>
        alternative.content.trim().length === 0,
    )
  ) {
    issues.push(
      QUESTION_PUBLICATION_ISSUES.ALTERNATIVE_CONTENT_REQUIRED,
    );
  }

  if (candidate.type === QUESTION_TYPES.MULTIPLE_CHOICE) {
    if (candidate.alternatives.length < 2) {
      issues.push(
        QUESTION_PUBLICATION_ISSUES
          .MULTIPLE_CHOICE_ALTERNATIVES_REQUIRED,
      );
    }

    const correctAlternatives =
      candidate.alternatives.filter(
        (alternative) => alternative.isCorrect,
      ).length;

    if (correctAlternatives !== 1) {
      issues.push(
        QUESTION_PUBLICATION_ISSUES
          .MULTIPLE_CHOICE_SINGLE_CORRECT_REQUIRED,
      );
    }

    if (candidate.correctTrueFalse !== null) {
      issues.push(
        QUESTION_PUBLICATION_ISSUES
          .MULTIPLE_CHOICE_BOOLEAN_ANSWER_NOT_ALLOWED,
      );
    }
  }

  if (candidate.type === QUESTION_TYPES.TRUE_FALSE) {
    if (candidate.alternatives.length > 0) {
      issues.push(
        QUESTION_PUBLICATION_ISSUES
          .TRUE_FALSE_ALTERNATIVES_NOT_ALLOWED,
      );
    }

    if (candidate.correctTrueFalse === null) {
      issues.push(
        QUESTION_PUBLICATION_ISSUES
          .TRUE_FALSE_ANSWER_REQUIRED,
      );
    }
  }

  return issues;
}

export function canPublishQuestion(
  candidate: QuestionPublicationCandidate,
): boolean {
  return validateQuestionForPublication(candidate).length === 0;
}
