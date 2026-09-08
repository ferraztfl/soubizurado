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
  SubmitPublishedQuestionAnswerUseCase,
} from "./submit-published-question-answer";

const multipleChoiceQuestion: PublishedQuestionRecord = {
  id: "question-mc",
  type: QUESTION_TYPES.MULTIPLE_CHOICE,
  statement: "Qual alternativa esta correta?",
  answerKeyStatus: "VERIFIED",
  correctTrueFalse: null,
  explanation: "A alternativa A esta correta.",
  alternatives: [
    {
      id: "alternative-a",
      label: "A",
      content: "Alternativa A",
      position: 1,
      isCorrect: true,
    },
    {
      id: "alternative-b",
      label: "B",
      content: "Alternativa B",
      position: 2,
      isCorrect: false,
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

const trueFalseQuestion: PublishedQuestionRecord = {
  id: "question-tf",
  type: QUESTION_TYPES.TRUE_FALSE,
  statement: "A afirmacao esta correta.",
  answerKeyStatus: "VERIFIED",
  correctTrueFalse: false,
  explanation: "A afirmacao esta incorreta.",
  alternatives: [],
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
    multipleChoiceQuestion;

  public lastQuestionId: string | null = null;

  public async listPublished(
    input: ListPublishedQuestionsRepositoryInput,
  ): Promise<ListPublishedQuestionsRepositoryResult> {
    void input;

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

describe("SubmitPublishedQuestionAnswerUseCase", () => {
  it("evaluates a correct multiple-choice answer and reveals the answer key", async () => {
    const repository =
      new FakeQuestionRepository();
    const useCase =
      new SubmitPublishedQuestionAnswerUseCase(
        repository,
      );

    const result = await useCase.execute({
      questionId: " question-mc ",
      answer: {
        type: "MULTIPLE_CHOICE",
        alternativeId: "alternative-a",
      },
    });

    expect(repository.lastQuestionId).toBe(
      "question-mc",
    );
    expect(result).toEqual({
      questionId: "question-mc",
      isCorrect: true,
      selectedAnswer: {
        type: "MULTIPLE_CHOICE",
        alternativeId: "alternative-a",
        label: "A",
        content: "Alternativa A",
      },
      correctAnswer: {
        type: "MULTIPLE_CHOICE",
        alternativeId: "alternative-a",
        label: "A",
        content: "Alternativa A",
      },
      explanation: "A alternativa A esta correta.",
    });
  });

  it("evaluates an incorrect multiple-choice answer", async () => {
    const repository =
      new FakeQuestionRepository();
    const useCase =
      new SubmitPublishedQuestionAnswerUseCase(
        repository,
      );

    const result = await useCase.execute({
      questionId: "question-mc",
      answer: {
        type: "MULTIPLE_CHOICE",
        alternativeId: "alternative-b",
      },
    });

    expect(result.isCorrect).toBe(false);
    expect(result.correctAnswer).toMatchObject({
      type: "MULTIPLE_CHOICE",
      alternativeId: "alternative-a",
    });
  });

  it("evaluates a True/False answer", async () => {
    const repository =
      new FakeQuestionRepository();
    repository.found = trueFalseQuestion;

    const useCase =
      new SubmitPublishedQuestionAnswerUseCase(
        repository,
      );

    const result = await useCase.execute({
      questionId: "question-tf",
      answer: {
        type: "TRUE_FALSE",
        value: true,
      },
    });

    expect(result.isCorrect).toBe(false);
    expect(result.correctAnswer).toEqual({
      type: "TRUE_FALSE",
      value: false,
    });
    expect(result.explanation).toBe(
      "A afirmacao esta incorreta.",
    );
  });

  it("rejects an answer type that does not match the question", async () => {
    const repository =
      new FakeQuestionRepository();
    const useCase =
      new SubmitPublishedQuestionAnswerUseCase(
        repository,
      );

    await expect(
      useCase.execute({
        questionId: "question-mc",
        answer: {
          type: "TRUE_FALSE",
          value: true,
        },
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects an alternative that does not belong to the question", async () => {
    const repository =
      new FakeQuestionRepository();
    const useCase =
      new SubmitPublishedQuestionAnswerUseCase(
        repository,
      );

    await expect(
      useCase.execute({
        questionId: "question-mc",
        answer: {
          type: "MULTIPLE_CHOICE",
          alternativeId: "other-alternative",
        },
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("returns not found when the published question does not exist", async () => {
    const repository =
      new FakeQuestionRepository();
    repository.found = null;

    const useCase =
      new SubmitPublishedQuestionAnswerUseCase(
        repository,
      );

    await expect(
      useCase.execute({
        questionId: "missing-question",
        answer: {
          type: "TRUE_FALSE",
          value: false,
        },
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("rejects an empty question id before repository lookup", async () => {
    const repository =
      new FakeQuestionRepository();
    const useCase =
      new SubmitPublishedQuestionAnswerUseCase(
        repository,
      );

    await expect(
      useCase.execute({
        questionId: "   ",
        answer: {
          type: "TRUE_FALSE",
          value: false,
        },
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });

    expect(repository.lastQuestionId).toBeNull();
  });
});
