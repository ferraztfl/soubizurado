import {
  ApplicationError,
} from "../../../../shared/errors/application-error";

import {
  ERROR_CODES,
} from "../../../../shared/errors/error-code";

import type {
  QuestionAnswerResultDto,
} from "../dto/question-answer-result";

import type {
  PublishedQuestionRecord,
  QuestionRepository,
} from "../ports/question-repository";

export type SubmitPublishedQuestionAnswerInput =
  | Readonly<{
      questionId: string;
      answer: Readonly<{
        type: "MULTIPLE_CHOICE";
        alternativeId: string;
      }>;
    }>
  | Readonly<{
      questionId: string;
      answer: Readonly<{
        type: "TRUE_FALSE";
        value: boolean;
      }>;
    }>;

function normalizeQuestionId(questionId: string): string {
  const normalized = questionId.trim();

  if (normalized.length === 0) {
    throw new ApplicationError(
      ERROR_CODES.VALIDATION_ERROR,
      "questionId is required.",
    );
  }

  return normalized;
}

function requireMatchingAnswerType(
  question: PublishedQuestionRecord,
  input: SubmitPublishedQuestionAnswerInput,
): void {
  if (question.type !== input.answer.type) {
    throw new ApplicationError(
      ERROR_CODES.VALIDATION_ERROR,
      "Submitted answer type does not match question type.",
    );
  }
}

function evaluateMultipleChoiceAnswer(
  question: PublishedQuestionRecord,
  input: Extract<
    SubmitPublishedQuestionAnswerInput,
    { answer: { type: "MULTIPLE_CHOICE" } }
  >,
): QuestionAnswerResultDto {
  const selectedAlternativeId =
    input.answer.alternativeId.trim();

  if (selectedAlternativeId.length === 0) {
    throw new ApplicationError(
      ERROR_CODES.VALIDATION_ERROR,
      "alternativeId is required.",
    );
  }

  const selectedAlternative =
    question.alternatives.find(
      (alternative) =>
        alternative.id === selectedAlternativeId,
    );

  if (!selectedAlternative) {
    throw new ApplicationError(
      ERROR_CODES.VALIDATION_ERROR,
      "Selected alternative does not belong to the question.",
    );
  }

  const correctAlternatives =
    question.alternatives.filter(
      (alternative) => alternative.isCorrect,
    );

  if (correctAlternatives.length !== 1) {
    throw new ApplicationError(
      ERROR_CODES.INTERNAL_ERROR,
      "Published multiple-choice question has an invalid answer key.",
    );
  }

  const correctAlternative = correctAlternatives[0];

  return {
    questionId: question.id,
    isCorrect:
      selectedAlternative.id === correctAlternative.id,
    selectedAnswer: {
      type: "MULTIPLE_CHOICE",
      alternativeId: selectedAlternative.id,
      label: selectedAlternative.label,
      content: selectedAlternative.content,
    },
    correctAnswer: {
      type: "MULTIPLE_CHOICE",
      alternativeId: correctAlternative.id,
      label: correctAlternative.label,
      content: correctAlternative.content,
    },
    explanation: question.explanation,
  };
}

function evaluateTrueFalseAnswer(
  question: PublishedQuestionRecord,
  input: Extract<
    SubmitPublishedQuestionAnswerInput,
    { answer: { type: "TRUE_FALSE" } }
  >,
): QuestionAnswerResultDto {
  if (typeof input.answer.value !== "boolean") {
    throw new ApplicationError(
      ERROR_CODES.VALIDATION_ERROR,
      "True/False answer must be a boolean.",
    );
  }

  if (question.correctTrueFalse === null) {
    throw new ApplicationError(
      ERROR_CODES.INTERNAL_ERROR,
      "Published True/False question has an invalid answer key.",
    );
  }

  return {
    questionId: question.id,
    isCorrect:
      input.answer.value === question.correctTrueFalse,
    selectedAnswer: {
      type: "TRUE_FALSE",
      value: input.answer.value,
    },
    correctAnswer: {
      type: "TRUE_FALSE",
      value: question.correctTrueFalse,
    },
    explanation: question.explanation,
  };
}

export class SubmitPublishedQuestionAnswerUseCase {
  public constructor(
    private readonly questionRepository: QuestionRepository,
  ) {}

  public async execute(
    input: SubmitPublishedQuestionAnswerInput,
  ): Promise<QuestionAnswerResultDto> {
    const questionId = normalizeQuestionId(
      input.questionId,
    );

    const question =
      await this.questionRepository.findPublishedById(
        questionId,
      );

    if (!question) {
      throw new ApplicationError(
        ERROR_CODES.NOT_FOUND,
        "Published question not found.",
      );
    }

    requireMatchingAnswerType(question, input);

    if (
      question.type === "MULTIPLE_CHOICE" &&
      input.answer.type === "MULTIPLE_CHOICE"
    ) {
      return evaluateMultipleChoiceAnswer(
        question,
        input,
      );
    }

    if (
      question.type === "TRUE_FALSE" &&
      input.answer.type === "TRUE_FALSE"
    ) {
      return evaluateTrueFalseAnswer(
        question,
        input,
      );
    }

    throw new ApplicationError(
      ERROR_CODES.INTERNAL_ERROR,
      "Question answer could not be evaluated.",
    );
  }
}
