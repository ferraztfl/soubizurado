import type {
  QuestionReviewRepository,
  ReviewQuestionListItem,
} from "../ports/question-review-repository";

export class ListQuestionsForReviewUseCase {
  public constructor(
    private readonly repository:
      QuestionReviewRepository,
  ) {}

  public execute(): Promise<
    readonly ReviewQuestionListItem[]
  > {
    return this.repository.listInReview();
  }
}
