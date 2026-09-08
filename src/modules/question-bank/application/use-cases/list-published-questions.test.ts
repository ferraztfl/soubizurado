import {
  describe,
  expect,
  it,
} from "vitest";

import {
  QUESTION_TYPES,
} from "../../domain/question-type";

import type {
  ListPublishedQuestionsRepositoryInput,
  ListPublishedQuestionsRepositoryResult,
  PublishedQuestionRecord,
  QuestionRepository,
} from "../ports/question-repository";

import {
  ListPublishedQuestionsUseCase,
} from "./list-published-questions";

const publishedQuestion: PublishedQuestionRecord = {
  id: "question-1",
  type: QUESTION_TYPES.MULTIPLE_CHOICE,
  statement: "Qual alternativa esta correta?",

  answerKeyStatus: "VERIFIED",
  correctTrueFalse: null,
  explanation: "A alternativa A esta correta.",

  alternatives: [
    {
      id: "alternative-b",
      label: "B",
      content: "Alternativa B",
      position: 2,
      isCorrect: false,
    },
    {
      id: "alternative-a",
      label: "A",
      content: "Alternativa A",
      position: 1,
      isCorrect: true,
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

class FakeQuestionRepository
  implements QuestionRepository
{
  public lastInput:
    | ListPublishedQuestionsRepositoryInput
    | null = null;

  public result:
    ListPublishedQuestionsRepositoryResult = {
      items: [publishedQuestion],
      total: 1,
    };

  public async listPublished(
    input: ListPublishedQuestionsRepositoryInput,
  ): Promise<ListPublishedQuestionsRepositoryResult> {
    this.lastInput = input;

    return this.result;
  }
}

describe("ListPublishedQuestionsUseCase", () => {
  it("uses bounded default pagination", async () => {
    const repository =
      new FakeQuestionRepository();

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

  it("does not expose answer data before answering", async () => {
    const repository =
      new FakeQuestionRepository();

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

  it("passes filters and pagination to repository", async () => {
    const repository =
      new FakeQuestionRepository();

    const useCase =
      new ListPublishedQuestionsUseCase(
        repository,
      );

    await useCase.execute({
      page: 3,
      pageSize: 10,
      filters: {
        disciplineId: "discipline-1",
        boardId: "board-1",
        year: 2026,
        type: QUESTION_TYPES.MULTIPLE_CHOICE,
      },
    });

    expect(repository.lastInput).toEqual({
      filters: {
        disciplineId: "discipline-1",
        boardId: "board-1",
        year: 2026,
        type: QUESTION_TYPES.MULTIPLE_CHOICE,
      },
      offset: 20,
      limit: 10,
    });
  });

  it("rejects invalid pagination", async () => {
    const repository =
      new FakeQuestionRepository();

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
  });
});
