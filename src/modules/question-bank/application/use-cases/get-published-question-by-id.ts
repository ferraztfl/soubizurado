import {
  ApplicationError,
} from "../../../../shared/errors/application-error";

import {
  ERROR_CODES,
} from "../../../../shared/errors/error-code";

import type {
  PublicQuestionDto,
} from "../dto/public-question";

import {
  toPublicQuestionDto,
} from "../mappers/to-public-question-dto";

import type {
  QuestionRepository,
} from "../ports/question-repository";

export class GetPublishedQuestionByIdUseCase {
  public constructor(
    private readonly questionRepository: QuestionRepository,
  ) {}

  public async execute(
    questionId: string,
  ): Promise<PublicQuestionDto> {
    const normalizedQuestionId = questionId.trim();

    if (normalizedQuestionId.length === 0) {
      throw new ApplicationError(
        ERROR_CODES.VALIDATION_ERROR,
        "questionId is required.",
      );
    }

    const question =
      await this.questionRepository.findPublishedById(
        normalizedQuestionId,
      );

    if (!question) {
      throw new ApplicationError(
        ERROR_CODES.NOT_FOUND,
        "Published question not found.",
      );
    }

    return toPublicQuestionDto(question);
  }
}
