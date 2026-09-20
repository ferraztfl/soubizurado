import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  ListPublicQuestionsRepositoryResult,
  PublicQuestionReadRecord,
  PublicQuestionReadRepository,
  QuestionExplorerFacets,
} from "../ports/public-question-read-repository";

import {
  ListQuestionExplorerFacetsUseCase,
} from "./list-question-explorer-facets";

class FakePublicQuestionReadRepository
  implements PublicQuestionReadRepository
{
  public async listPublished(): Promise<ListPublicQuestionsRepositoryResult> {
    return {
      items: [],
      total: 0,
    };
  }

  public async findPublishedById(): Promise<PublicQuestionReadRecord | null> {
    return null;
  }

  public async listExplorerFacets(): Promise<QuestionExplorerFacets> {
    return {
      disciplines: [
        {
          id: "discipline-1",
          name: "Direito Constitucional",
        },
      ],
      boards: [
        {
          id: "board-1",
          name: "Instituto AOCP",
          acronym: "AOCP",
        },
      ],
      years: [2026, 2025],
      types: [
        "MULTIPLE_CHOICE",
        "TRUE_FALSE",
      ],
    };
  }
}

describe("ListQuestionExplorerFacetsUseCase", () => {
  it("returns available explorer facets", async () => {
    const useCase =
      new ListQuestionExplorerFacetsUseCase(
        new FakePublicQuestionReadRepository(),
      );

    await expect(
      useCase.execute(),
    ).resolves.toEqual({
      disciplines: [
        {
          id: "discipline-1",
          name: "Direito Constitucional",
        },
      ],
      boards: [
        {
          id: "board-1",
          name: "Instituto AOCP",
          acronym: "AOCP",
        },
      ],
      years: [2026, 2025],
      types: [
        "MULTIPLE_CHOICE",
        "TRUE_FALSE",
      ],
    });
  });
});
