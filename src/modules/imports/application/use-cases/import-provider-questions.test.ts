import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  ProviderExaminationMetadata,
  QuestionProvider,
  QuestionProviderListResult,
} from "../ports/question-provider";
import type {
  QuestionImportRepository,
  PersistImportedQuestionInput,
  PersistImportedQuestionResult,
  RecordImportReviewInput,
} from "../ports/question-import-repository";

import {
  ImportProviderQuestionsUseCase,
} from "./import-provider-questions";

class FakeProvider
  implements QuestionProvider
{
  public page: QuestionProviderListResult = {
    total: 1,
    nextCursor: "q-1",
    correlationId: "corr-1",
    items: [
      {
        externalId: "q-1",
        number: "10",
        statementHtml:
          "<p>Assinale a alternativa correta.</p>",
        alternatives: [
          {
            label: "A",
            contentHtml:
              "<p>Alternativa A</p>",
            imageUrls: [],
          },
          {
            label: "B",
            contentHtml:
              "<p>Alternativa B</p>",
            imageUrls: [],
          },
        ],
        answerKey: "B",
        examinationExternalIds: [
          "exam-1",
        ],
        discipline:
          "Direito Administrativo",
        topic: "Atos administrativos",
        supportTextsHtml: [
          "<p>Considere a situação.</p>",
        ],
        attachmentUrls: [],
        hasImages: false,
        hasAnswerKey: true,
        hasSupportText: true,
        rawPayload: {
          id: "q-1",
        },
      },
    ],
  };

  public examination:
    ProviderExaminationMetadata | null = {
      externalId: "exam-1",
      organization: "TCE-PE",
      careerPosition: "Auditor",
      year: 2026,
      board: "FGV",
      alternativeType:
        "MULTIPLA_ESCOLHA",
    };

  public async listQuestions(): Promise<QuestionProviderListResult> {
    return this.page;
  }

  public async getExamination(): Promise<ProviderExaminationMetadata | null> {
    return this.examination;
  }
}

class FakeImportRepository
  implements QuestionImportRepository
{
  public persisted:
    PersistImportedQuestionInput[] = [];
  public reviews:
    RecordImportReviewInput[] = [];

  public persistResult:
    PersistImportedQuestionResult = {
      status: "IMPORTED",
      questionId:
        "550e8400-e29b-41d4-a716-446655440000",
    };

  public async ensureSource() {
    return {
      id: "source-1",
    };
  }

  public async createJob() {
    return {
      id: "job-1",
    };
  }

  public async persistQuestion(
    input: PersistImportedQuestionInput,
  ): Promise<PersistImportedQuestionResult> {
    this.persisted.push(input);

    return this.persistResult;
  }

  public async recordReview(
    input: RecordImportReviewInput,
  ): Promise<void> {
    this.reviews.push(input);
  }

  public async recordFailure(): Promise<void> {}

  public async completeJob(): Promise<void> {}

  public async failJob(): Promise<void> {}
}

describe("ImportProviderQuestionsUseCase", () => {
  it("normalizes and persists complete provider questions into the local bank", async () => {
    const provider = new FakeProvider();
    const repository =
      new FakeImportRepository();

    const useCase =
      new ImportProviderQuestionsUseCase(
        provider,
        repository,
      );

    const result = await useCase.execute({
      limit: 1,
      publish: false,
    });

    expect(result).toEqual({
      jobId: "job-1",
      received: 1,
      imported: 1,
      duplicates: 0,
      reviewRequired: 0,
      failed: 0,
      nextCursor: "q-1",
    });

    expect(repository.persisted).toHaveLength(
      1,
    );

    expect(
      repository.persisted[0],
    ).toMatchObject({
      jobId: "job-1",
      sourceId: "source-1",
      externalId: "q-1",
      externalQuestionNumber: "10",
      type: "MULTIPLE_CHOICE",
      status: "IN_REVIEW",
      answerKeyStatus: "DEFINED",
      statement:
        "Assinale a alternativa correta.",
      disciplineName:
        "Direito Administrativo",
      topicName: "Atos administrativos",
      examination: {
        externalId: "exam-1",
        organization: "TCE-PE",
        careerPosition: "Auditor",
        year: 2026,
        board: "FGV",
      },
      alternatives: [
        {
          label: "A",
          content: "Alternativa A",
          position: 0,
          isCorrect: false,
        },
        {
          label: "B",
          content: "Alternativa B",
          position: 1,
          isCorrect: true,
        },
      ],
      correctTrueFalse: null,
      supportContents: [
        {
          content:
            "Considere a situação.",
          position: 0,
          contentHash: expect.stringMatching(
            /^[a-f0-9]{64}$/,
          ),
        },
      ],
      canonicalFingerprint:
        expect.stringMatching(
          /^[a-f0-9]{64}$/,
        ),
      contentHash: expect.stringMatching(
        /^[a-f0-9]{64}$/,
      ),
      rawPayload: {
        id: "q-1",
      },
    });
  });

  it("routes image-bearing questions to review until media persistence is ready", async () => {
    const provider = new FakeProvider();
    provider.page = {
      ...provider.page,
      items: [
        {
          ...provider.page.items[0],
          hasImages: true,
          attachmentUrls: [
            "https://example.test/image.png",
          ],
        },
      ],
    };

    const repository =
      new FakeImportRepository();

    const useCase =
      new ImportProviderQuestionsUseCase(
        provider,
        repository,
      );

    const result = await useCase.execute({
      limit: 1,
    });

    expect(result.reviewRequired).toBe(1);
    expect(repository.persisted).toHaveLength(
      0,
    );
    expect(repository.reviews).toHaveLength(
      1,
    );
    expect(
      repository.reviews[0]?.reason,
    ).toBe("MEDIA_NOT_PERSISTED_YET");
  });

  it("counts exact duplicates reported by persistence without creating another question", async () => {
    const provider = new FakeProvider();
    const repository =
      new FakeImportRepository();

    repository.persistResult = {
      status: "DUPLICATE",
      questionId:
        "550e8400-e29b-41d4-a716-446655440000",
    };

    const useCase =
      new ImportProviderQuestionsUseCase(
        provider,
        repository,
      );

    const result = await useCase.execute({
      limit: 1,
    });

    expect(result.imported).toBe(0);
    expect(result.duplicates).toBe(1);
  });
});
