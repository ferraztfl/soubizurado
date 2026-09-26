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
  ListPublishedQuestionsUseCase,
} from "./list-published-questions";

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

  examination: {
    id: "exam-1",
    title: "Concurso 2026",
    year: 2026,
    board: {
      id: "board-1",
      name: "Banca Exemplo",
      acronym: "BE",
    },
  },
};

class FakePublicQuestionReadRepository
  implements PublicQuestionReadRepository
{
  public lastInput:
    | ListPublicQuestionsRepositoryInput
    | null = null;

  public result:
    ListPublicQuestionsRepositoryResult = {
      items: [publishedQuestion],
      total: 1,
    };

  public async listPublished(
    input: ListPublicQuestionsRepositoryInput,
  ): Promise<ListPublicQuestionsRepositoryResult> {
    this.lastInput = input;

    return this.result;
  }

  public async findPublishedById(): Promise<PublicQuestionReadRecord | null> {
    return null;
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

describe("ListPublishedQuestionsUseCase", () => {
  it("uses bounded default pagination", async () => {
    const repository =
      new FakePublicQuestionReadRepository();

    const useCase =
      new ListPublishedQuestionsUseCase(
        repository,
      );

    const result = await useCase.execute();

    expect(repository.lastInput).toEqual({
      filters: {},
      offset: 0,
      limit: 20,
    });

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it("returns only public question data", async () => {
    const repository =
      new FakePublicQuestionReadRepository();

    const useCase =
      new ListPublishedQuestionsUseCase(
        repository,
      );

    const result = await useCase.execute();
    const question = result.items.at(0);

    expect(question).toBeDefined();

    if (!question) {
      throw new Error("Expected a published question.");
    }

    expect(question).not.toHaveProperty(
      "answerKeyStatus",
    );
    expect(question).not.toHaveProperty(
      "correctTrueFalse",
    );
    expect(question).not.toHaveProperty(
      "explanation",
    );
    expect(
      question.alternatives[0],
    ).not.toHaveProperty("isCorrect");

    expect(
      question.alternatives.map(
        (alternative) => alternative.label,
      ),
    ).toEqual(["A", "B"]);
  });

  it("normalizes filters and pagination", async () => {
    const repository =
      new FakePublicQuestionReadRepository();

    const useCase =
      new ListPublishedQuestionsUseCase(
        repository,
      );

    await useCase.execute({
      page: 3,
      pageSize: 10,
      filters: {
        search: "  constitucional  ",
        disciplineId: " discipline-1 ",
        boardId: " board-1 ",
        year: 2026,
        type: QUESTION_TYPES.MULTIPLE_CHOICE,
      },
    });

    expect(repository.lastInput).toEqual({
      filters: {
        search: "constitucional",
        disciplineId: "discipline-1",
        boardId: "board-1",
        year: 2026,
        type: QUESTION_TYPES.MULTIPLE_CHOICE,
      },
      offset: 20,
      limit: 10,
    });
  });

  it("rejects invalid pagination and filters", async () => {
    const repository =
      new FakePublicQuestionReadRepository();

    const useCase =
      new ListPublishedQuestionsUseCase(
        repository,
      );

    await expect(
      useCase.execute({
        page: 0,
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });

    await expect(
      useCase.execute({
        pageSize: 51,
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });

    await expect(
      useCase.execute({
        filters: {
          year: 1800,
        },
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });

    await expect(
      useCase.execute({
        filters: {
          search: "x".repeat(121),
        },
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });
});
