import {
  ApplicationError,
} from "@/shared/errors/application-error";
import {
  ERROR_CODES,
} from "@/shared/errors/error-code";

import type {
  QuestionReviewRepository,
  ReviewTaxonomyReference,
} from "../ports/question-review-repository";

export class AssignQuestionTopicUseCase {
  public constructor(
    private readonly repository:
      QuestionReviewRepository,
  ) {}

  public async execute(
    input: Readonly<{
      questionId: string;
      topicName: string;
    }>,
  ): Promise<ReviewTaxonomyReference> {
    const questionId =
      input.questionId.trim();
    const topicName =
      input.topicName.trim();

    if (!questionId) {
      throw new ApplicationError(
        ERROR_CODES.VALIDATION_ERROR,
        "Question id is required.",
      );
    }

    if (
      topicName.length < 2 ||
      topicName.length > 180
    ) {
      throw new ApplicationError(
        ERROR_CODES.VALIDATION_ERROR,
        "Topic name must have between 2 and 180 characters.",
      );
    }

    const topic =
      await this.repository.assignTopic({
        questionId,
        topicName,
      });

    if (!topic) {
      throw new ApplicationError(
        ERROR_CODES.NOT_FOUND,
        "Question in review was not found.",
      );
    }

    return topic;
  }
}
