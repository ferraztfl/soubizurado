import {
  ApplicationError,
} from "../../../../shared/errors/application-error";
import {
  ERROR_CODES,
} from "../../../../shared/errors/error-code";
import {
  validateStudyAnswerAttempt,
} from "../../domain/study-answer-attempt-policy";
import type {
  QuestionAnswerEvaluator,
  StudyAnswerDisplay,
  StudySubmittedAnswer,
} from "../ports/question-answer-evaluator";
import type {
  StudyRepository,
} from "../ports/study-repository";

export type SubmitStudyQuestionAnswerInput = Readonly<{
  profileId: string;
  questionId: string;
  answer: StudySubmittedAnswer;
  responseTimeMs?: number | null;
}>;

export type SubmitStudyQuestionAnswerOutput = Readonly<{
  attemptId: string;
  answeredAt: Date;
  questionId: string;
  isCorrect: boolean;
  selectedAnswer: StudyAnswerDisplay;
  correctAnswer: StudyAnswerDisplay;
  explanation: string | null;
}>;

function requireText(
  value: string,
  field: string,
): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new ApplicationError(
      ERROR_CODES.VALIDATION_ERROR,
      `${field} is required.`,
    );
  }

  return normalized;
}

function normalizeAnswer(
  answer: StudySubmittedAnswer,
): StudySubmittedAnswer {
  if (answer.type === "MULTIPLE_CHOICE") {
    return {
      type: "MULTIPLE_CHOICE",
      alternativeId: requireText(
        answer.alternativeId,
        "alternativeId",
      ),
    };
  }

  if (typeof answer.value !== "boolean") {
    throw new ApplicationError(
      ERROR_CODES.VALIDATION_ERROR,
      "True/False answer must be a boolean.",
    );
  }

  return {
    type: "TRUE_FALSE",
    value: answer.value,
  };
}

function normalizeResponseTime(
  responseTimeMs: number | null | undefined,
): number | null {
  if (responseTimeMs === undefined || responseTimeMs === null) {
    return null;
  }

  if (
    !Number.isSafeInteger(responseTimeMs) ||
    responseTimeMs < 0
  ) {
    throw new ApplicationError(
      ERROR_CODES.VALIDATION_ERROR,
      "responseTimeMs must be a non-negative integer.",
    );
  }

  return responseTimeMs;
}

export class SubmitStudyQuestionAnswerUseCase {
  public constructor(
    private readonly answerEvaluator: QuestionAnswerEvaluator,
    private readonly studyRepository: StudyRepository,
  ) {}

  public async execute(
    input: SubmitStudyQuestionAnswerInput,
  ): Promise<SubmitStudyQuestionAnswerOutput> {
    const profileId = requireText(
      input.profileId,
      "profileId",
    );
    const questionId = requireText(
      input.questionId,
      "questionId",
    );
    const answer = normalizeAnswer(input.answer);
    const responseTimeMs = normalizeResponseTime(
      input.responseTimeMs,
    );

    const evaluation = await this.answerEvaluator.evaluate({
      questionId,
      answer,
    });

    if (
      evaluation.questionId !== questionId ||
      evaluation.questionType !== answer.type ||
      evaluation.selectedAnswer.type !== answer.type ||
      evaluation.correctAnswer.type !== answer.type
    ) {
      throw new ApplicationError(
        ERROR_CODES.INTERNAL_ERROR,
        "Question answer evaluator returned an inconsistent result.",
      );
    }

    const selectedAlternativeId =
      evaluation.selectedAnswer.type === "MULTIPLE_CHOICE"
        ? evaluation.selectedAnswer.alternativeId
        : null;
    const selectedTrueFalse =
      evaluation.selectedAnswer.type === "TRUE_FALSE"
        ? evaluation.selectedAnswer.value
        : null;

    const attemptCandidate = {
      profileId,
      questionId,
      questionType: evaluation.questionType,
      selectedAlternativeId,
      selectedTrueFalse,
      responseTimeMs,
    } as const;

    const issues = validateStudyAnswerAttempt(
      attemptCandidate,
    );

    if (issues.length > 0) {
      throw new ApplicationError(
        ERROR_CODES.INTERNAL_ERROR,
        "Question answer evaluator produced an invalid study attempt.",
      );
    }

    const attempt =
      await this.studyRepository.createAnswerAttempt({
        ...attemptCandidate,
        isCorrect: evaluation.isCorrect,
      });

    return {
      attemptId: attempt.id,
      answeredAt: attempt.answeredAt,
      questionId,
      isCorrect: evaluation.isCorrect,
      selectedAnswer: evaluation.selectedAnswer,
      correctAnswer: evaluation.correctAnswer,
      explanation: evaluation.explanation,
    };
  }
}
