import { describe, expect, it, vi } from "vitest";

import type {
  ProviderClassification,
  QuestionClassificationInput,
  QuestionClassifier,
} from "../domain/question-classifier";
import { TaxonomyIndex } from "../domain/taxonomy-index";

import type { ClassificationTaskRepository } from "./ports/classification-task-repository";
import {
  classificationRetryDelaySeconds,
  processClassificationQueue,
} from "./process-classification-queue";

const taxonomy = new TaxonomyIndex({
  version: 3,
  disciplines: [
    { id: "mat", name: "Matemática", slug: "matematica", knowledgeAreaId: "ka", aliases: [] },
  ],
  areas: [{ id: "alg", disciplineId: "mat", name: "Álgebra", aliases: [] }],
  topics: [{ id: "funcoes", disciplineId: "mat", areaId: "alg", name: "Funções", aliases: [] }],
  subtopics: [],
});

function question(id: string): QuestionClassificationInput {
  return {
    questionId: id,
    statement: "…",
    supportTexts: [],
    alternatives: [],
    knowledgeAreaId: "ka",
    disciplineId: "mat",
  };
}

function repository(
  overrides: Partial<ClassificationTaskRepository> = {},
): ClassificationTaskRepository {
  return {
    loadTaxonomyIndex: vi.fn().mockResolvedValue(taxonomy),
    recoverStaleTasks: vi.fn().mockResolvedValue(0),
    claimTasks: vi.fn().mockResolvedValue([
      { id: "t1", questionId: "q1", attempts: 1 },
      { id: "t2", questionId: "q2", attempts: 1 },
      { id: "t3", questionId: "gone", attempts: 3 },
    ]),
    loadQuestionInput: vi.fn(async (id: string) =>
      id === "gone" ? null : question(id),
    ),
    completeTask: vi.fn().mockResolvedValue(undefined),
    retryOrFailTask: vi.fn().mockResolvedValue("PENDING"),
    failTask: vi.fn().mockResolvedValue(undefined),
    enqueue: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

function classifier(
  classify: (input: QuestionClassificationInput) => Promise<ProviderClassification>,
): QuestionClassifier {
  return { provider: "fake", model: null, version: "fake-v1", classify };
}

const base = {
  taxonomy,
  limit: 10,
  concurrency: 2,
  maxAttempts: 3,
  staleMinutes: 15,
  minimumConfidence: 0.8,
};

describe("processClassificationQueue", () => {
  it("stores resolved suggestions and fails tasks whose question is gone", async () => {
    const repo = repository();

    const output = await processClassificationQueue({
      ...base,
      repository: repo,
      classifier: classifier(async (input) => ({
        discipline: "Matemática",
        area: "Álgebra",
        topic: "Funções",
        subtopic: null,
        tags: [],
        confidence: input.questionId === "q1" ? 0.95 : 0.4,
      })),
    });

    expect(output).toEqual({
      recovered: 0,
      claimed: 3,
      completed: 1,
      reviewRequired: 1,
      retried: 0,
      failed: 1,
    });

    expect(repo.claimTasks).toHaveBeenCalledWith({
      limit: 10,
      classifierVersion: "fake-v1",
      taxonomyVersion: 3,
    });
    expect(repo.completeTask).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "t1",
        status: "COMPLETED",
        resolved: expect.objectContaining({ topicId: "funcoes", areaId: "alg" }),
      }),
    );
    expect(repo.failTask).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: "t3" }),
    );
  });

  it("retries provider errors with backoff", async () => {
    const repo = repository({
      claimTasks: vi.fn().mockResolvedValue([
        { id: "t1", questionId: "q1", attempts: 2 },
      ]),
    });

    const output = await processClassificationQueue({
      ...base,
      repository: repo,
      classifier: classifier(async () => {
        throw new Error("HTTP 503");
      }),
    });

    expect(output.retried).toBe(1);
    expect(repo.retryOrFailTask).toHaveBeenCalledWith({
      taskId: "t1",
      maxAttempts: 3,
      retryDelaySeconds: 120,
      message: "HTTP 503",
    });
  });

  it("validates operational limits", async () => {
    await expect(
      processClassificationQueue({
        ...base,
        concurrency: 0,
        repository: repository(),
        classifier: classifier(async () => {
          throw new Error("unused");
        }),
      }),
    ).rejects.toThrow("concurrency");
  });
});

describe("classificationRetryDelaySeconds", () => {
  it("grows exponentially up to the cap", () => {
    expect(classificationRetryDelaySeconds(1, 60, 3_600)).toBe(60);
    expect(classificationRetryDelaySeconds(3, 60, 3_600)).toBe(240);
    expect(classificationRetryDelaySeconds(20, 60, 3_600)).toBe(3_600);
  });
});
