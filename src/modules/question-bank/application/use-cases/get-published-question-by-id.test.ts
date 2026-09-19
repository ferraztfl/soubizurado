import {
  describe,
  expect,
  it,
} from "vitest";

import {
  QUESTION_TYPES,
} from "../../domain/question-type";

import type {
  ListPublicQuestionsRepositoryInput,
  ListPublicQuestionsRepositoryResult,
  PublicQuestionReadRecord,
  PublicQuestionReadRepository,
  QuestionExplorerFacets,
} from "../ports/public-question-read-repository";

import {
  GetPublishedQuestionByIdUseCase,
} from "./get-published-question-by-id";

const publishedQuestion: PublicQuestionReadRecord = {
  id: "question-1",
  type: QUESTION_TYPES.MULTIPLE_CHOICE,
  statement: "Qual alternativa esta correta?",
  alternatives: [
    {
      id: "alternative-b",
      label: "B",
      content: "Alternativa B",
      position: 2,
    },
    {
      id: "alternative-a",
      label: "A",
      content: "Alternativa A",
      position: 1,
    },
  ],
  discipline: {
    id: "discipline-1",
    name: "Direito Constitucional",
  },
  area: null,
  topic: {
    id: "topic-1",
    name: "Direitos Fundamentais",
  },
  subtopic: null,
  examination: null,
};

class FakePublicQuestionReadRepository
  implements PublicQuestionReadRepository
{
  public found: PublicQuestionReadRecord | null =
    publishedQuestion;

  public lastQuestionId: string | null = null;

  public async listPublished(): Promise<ListPublicQuestionsRepositoryResult> {
    return {
      items: [],
      total: 0,
    };
  }

  public async findPublishedById(
    questionId: string,
  ): Promise<PublicQuestionReadRecord | null> {
    this.lastQuestionId = questionId;

    return this.found;
  }

  public async listExplorerFacets(): Promise<QuestionExplorerFacets> {
    return {
      disciplines: [],
      boards: [],
      years: [],
      types: [],
    };
  }
}

describe("GetPublishedQuestionByIdUseCase", () => {
  it("returns a public DTO", async () => {
    const repository =
      new FakePublicQuestionReadRepository();

    const useCase =
      new GetPublishedQuestionByIdUseCase(
        repository,
      );

    const result = await useCase.execute(
      "question-1",
    );

    expect(result.id).toBe("question-1");
    expect(result).not.toHaveProperty(
      "answerKeyStatus",
    );
    expect(result).not.toHaveProperty(
      "correctTrueFalse",
    );
    expect(result).not.toHaveProperty(
      "explanation",
    );
    expect(result.alternatives).toEqual([
      {
        id: "alternative-a",
        label: "A",
        content: "Alternativa A",
        position: 1,
      },
      {
        id: "alternative-b",
        label: "B",
        content: "Alternativa B",
        position: 2,
      },
    ]);
  });

  it("normalizes the question id before repository lookup", async () => {
    const repository =
      new FakePublicQuestionReadRepository();

    const useCase =
      new GetPublishedQuestionByIdUseCase(
        repository,
      );

    await useCase.execute("  question-1  ");

    expect(repository.lastQuestionId).toBe(
      "question-1",
    );
  });

  it("rejects an empty question id", async () => {
    const repository =
      new FakePublicQuestionReadRepository();

    const useCase =
      new GetPublishedQuestionByIdUseCase(
        repository,
      );

    await expect(
      useCase.execute("   "),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("returns not found when the published question does not exist", async () => {
    const repository =
      new FakePublicQuestionReadRepository();
    repository.found = null;

    const useCase =
      new GetPublishedQuestionByIdUseCase(
        repository,
      );

    await expect(
      useCase.execute("missing-question"),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
