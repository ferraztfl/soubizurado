import {
  describe,
  expect,
  it,
} from "vitest";

import {
  ApplicationError,
} from "@/shared/errors/application-error";

import type {
  QuestionReviewRepository,
  ReviewPublicationCandidate,
  ReviewQuestionListItem,
  ReviewTaxonomyReference,
} from "../ports/question-review-repository";

import {
  AssignQuestionTopicUseCase,
} from "./assign-question-topic";
import {
  ListQuestionsForReviewUseCase,
} from "./list-questions-for-review";
import {
  PublishReviewedQuestionUseCase,
} from "./publish-reviewed-question";

class FakeQuestionReviewRepository
  implements QuestionReviewRepository
{
  public questions:
    readonly ReviewQuestionListItem[] = [];
  public assignedInput:
    | Readonly<{
        questionId: string;
        topicName: string;
      }>
    | null = null;
  public assignedTopic:
    | ReviewTaxonomyReference
    | null = {
      id: "topic-1",
      name: "Nutrição Clínica",
    };
  public publicationCandidate:
    | ReviewPublicationCandidate
    | null = {
      id: "question-1",
      type: "MULTIPLE_CHOICE",
      statement:
        "Assinale a alternativa correta.",
      sourceId: "source-1",
      disciplineId: "discipline-1",
      topicId: "topic-1",
      correctTrueFalse: null,
      alternatives: [
        {
          content: "Alternativa A",
          isCorrect: true,
        },
        {
          content: "Alternativa B",
          isCorrect: false,
        },
      ],
    };
  public publishResult = true;
  public publishedQuestionId:
    | string
    | null = null;

  public async listInReview(): Promise<
    readonly ReviewQuestionListItem[]
  > {
    return this.questions;
  }

  public async assignTopic(
    input: Readonly<{
      questionId: string;
      topicName: string;
    }>,
  ): Promise<ReviewTaxonomyReference | null> {
    this.assignedInput = input;

    return this.assignedTopic;
  }

  public async findPublicationCandidate(): Promise<ReviewPublicationCandidate | null> {
    return this.publicationCandidate;
  }

  public async publishQuestion(
    questionId: string,
  ): Promise<boolean> {
    this.publishedQuestionId =
      questionId;

    return this.publishResult;
  }
}

describe("question review use cases", () => {
  it("lists questions waiting for review", async () => {
    const repository =
      new FakeQuestionReviewRepository();
    repository.questions = [
      {
        id: "question-1",
        type: "MULTIPLE_CHOICE",
        statement: "Questão em revisão.",
        answerKeyStatus: "DEFINED",
        discipline: {
          id: "discipline-1",
          name: "Nutrição",
        },
        topic: null,
        examination: null,
        updatedAt: new Date(
          "2026-09-20T10:00:00.000Z",
        ),
      },
    ];

    const useCase =
      new ListQuestionsForReviewUseCase(
        repository,
      );

    await expect(
      useCase.execute(),
    ).resolves.toEqual(
      repository.questions,
    );
  });

  it("normalizes and assigns a topic to an in-review question", async () => {
    const repository =
      new FakeQuestionReviewRepository();
    const useCase =
      new AssignQuestionTopicUseCase(
        repository,
      );

    await expect(
      useCase.execute({
        questionId: " question-1 ",
        topicName:
          " Nutrição Clínica ",
      }),
    ).resolves.toEqual({
      id: "topic-1",
      name: "Nutrição Clínica",
    });

    expect(
      repository.assignedInput,
    ).toEqual({
      questionId: "question-1",
      topicName: "Nutrição Clínica",
    });
  });

  it("rejects an invalid topic name before persistence", async () => {
    const repository =
      new FakeQuestionReviewRepository();
    const useCase =
      new AssignQuestionTopicUseCase(
        repository,
      );

    await expect(
      useCase.execute({
        questionId: "question-1",
        topicName: "x",
      }),
    ).rejects.toMatchObject({
      name: "ApplicationError",
      code: "VALIDATION_ERROR",
    } satisfies Partial<ApplicationError>);

    expect(
      repository.assignedInput,
    ).toBeNull();
  });

  it("blocks publication while required taxonomy is missing", async () => {
    const repository =
      new FakeQuestionReviewRepository();
    repository.publicationCandidate = {
      ...repository.publicationCandidate!,
      topicId: null,
    };

    const useCase =
      new PublishReviewedQuestionUseCase(
        repository,
      );

    await expect(
      useCase.execute("question-1"),
    ).rejects.toMatchObject({
      name: "ApplicationError",
      code: "VALIDATION_ERROR",
    } satisfies Partial<ApplicationError>);

    expect(
      repository.publishedQuestionId,
    ).toBeNull();
  });

  it("publishes only a candidate that satisfies the publication policy", async () => {
    const repository =
      new FakeQuestionReviewRepository();
    const useCase =
      new PublishReviewedQuestionUseCase(
        repository,
      );

    await expect(
      useCase.execute("question-1"),
    ).resolves.toBeUndefined();

    expect(
      repository.publishedQuestionId,
    ).toBe("question-1");
  });

  it("reports a conflict if review state changed before publication", async () => {
    const repository =
      new FakeQuestionReviewRepository();
    repository.publishResult = false;

    const useCase =
      new PublishReviewedQuestionUseCase(
        repository,
      );

    await expect(
      useCase.execute("question-1"),
    ).rejects.toMatchObject({
      name: "ApplicationError",
      code: "CONFLICT",
    } satisfies Partial<ApplicationError>);
  });
});
