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
  GetPublishedQuestionByIdUseCase,
} from "./get-published-question-by-id";

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
  examination: null,
};

class FakeQuestionRepository
  implements QuestionRepository
{
  public found: PublishedQuestionRecord | null =
    publishedQuestion;

  public lastQuestionId: string | null = null;

  public async listPublished(
    _input: ListPublishedQuestionsRepositoryInput,
  ): Promise<ListPublishedQuestionsRepositoryResult> {
    return {
      items: [],
      total: 0,
    };
  }

  public async findPublishedById(
    questionId: string,
  ): Promise<PublishedQuestionRecord | null> {
    this.lastQuestionId = questionId;

    return this.found;
  }
}

describe("GetPublishedQuestionByIdUseCase", () => {
  it("returns a public DTO without answer data", async () => {
    const repository =
      new FakeQuestionRepository();

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
      new FakeQuestionRepository();

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
      new FakeQuestionRepository();

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
      new FakeQuestionRepository();
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
