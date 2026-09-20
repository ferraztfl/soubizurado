import {
  ApplicationError,
} from "@/shared/errors/application-error";
import {
  ERROR_CODES,
} from "@/shared/errors/error-code";

import {
  validateQuestionForPublication,
} from "../../domain/question-publication-policy";
import type {
  QuestionReviewRepository,
} from "../ports/question-review-repository";

export class PublishReviewedQuestionUseCase {
  public constructor(
    private readonly repository:
      QuestionReviewRepository,
  ) {}

  public async execute(
    questionIdInput: string,
  ): Promise<void> {
    const questionId =
      questionIdInput.trim();

    if (!questionId) {
      throw new ApplicationError(
        ERROR_CODES.VALIDATION_ERROR,
        "Question id is required.",
      );
    }

    const candidate =
      await this.repository.findPublicationCandidate(
        questionId,
      );

    if (!candidate) {
      throw new ApplicationError(
        ERROR_CODES.NOT_FOUND,
        "Question in review was not found.",
      );
    }

    const issues =
      validateQuestionForPublication({
        type: candidate.type,
        statement: candidate.statement,
        sourceId: candidate.sourceId,
        disciplineId:
          candidate.disciplineId,
        topicId: candidate.topicId,
        correctTrueFalse:
          candidate.correctTrueFalse,
        alternatives:
          candidate.alternatives,
      });

    if (issues.length > 0) {
      throw new ApplicationError(
        ERROR_CODES.VALIDATION_ERROR,
        `Question cannot be published: ${issues.join(
          ", ",
        )}.`,
      );
    }

    const published =
      await this.repository.publishQuestion(
        questionId,
      );

    if (!published) {
      throw new ApplicationError(
        ERROR_CODES.CONFLICT,
        "Question is no longer available for review.",
      );
    }
  }
}
