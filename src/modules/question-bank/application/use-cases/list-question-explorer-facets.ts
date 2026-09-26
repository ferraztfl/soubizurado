import type {
  PublicQuestionReadRepository,
  QuestionExplorerFacets,
} from "../ports/public-question-read-repository";

export class ListQuestionExplorerFacetsUseCase {
  public constructor(
    private readonly repository: Pick<
      PublicQuestionReadRepository,
      "listExplorerFacets"
    >,
  ) {}

  public execute(): Promise<QuestionExplorerFacets> {
    return this.repository.listExplorerFacets();
  }
}
