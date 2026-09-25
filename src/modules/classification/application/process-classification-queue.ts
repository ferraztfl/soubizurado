import type { QuestionClassifier } from "../domain/question-classifier";
import {
  decideClassificationStatus,
  resolveProviderClassification,
} from "../domain/resolve-classification";
import type { TaxonomyIndex } from "../domain/taxonomy-index";

import type {
  ClaimedClassificationTask,
  ClassificationTaskRepository,
} from "./ports/classification-task-repository";

export type ProcessClassificationQueueInput = Readonly<{
  repository: ClassificationTaskRepository;
  classifier: QuestionClassifier;
  taxonomy: TaxonomyIndex;
  limit: number;
  concurrency: number;
  maxAttempts: number;
  staleMinutes: number;
  minimumConfidence: number;
  retryBaseSeconds?: number;
  retryMaxSeconds?: number;
}>;

export type ProcessClassificationQueueOutput = Readonly<{
  recovered: number;
  claimed: number;
  completed: number;
  reviewRequired: number;
  retried: number;
  failed: number;
}>;

type Outcome = "COMPLETED" | "REVIEW_REQUIRED" | "RETRIED" | "FAILED";

export function classificationRetryDelaySeconds(
  attempts: number,
  baseSeconds: number,
  maxSeconds: number,
): number {
  return Math.min(
    maxSeconds,
    baseSeconds * 2 ** Math.min(Math.max(attempts - 1, 0), 30),
  );
}

function assertIntegerInRange(
  name: string,
  value: number,
  min: number,
  max: number,
): void {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
}

async function processOne(
  input: ProcessClassificationQueueInput,
  task: ClaimedClassificationTask,
  retryBaseSeconds: number,
  retryMaxSeconds: number,
): Promise<Outcome> {
  const question = await input.repository.loadQuestionInput(task.questionId);

  if (!question) {
    await input.repository.failTask({
      taskId: task.id,
      message: "Question is no longer available for classification.",
    });

    return "FAILED";
  }

  try {
    const providerResult = await input.classifier.classify(
      question,
      input.taxonomy,
    );

    const resolved = resolveProviderClassification(
      input.taxonomy,
      question,
      providerResult,
    );

    const status = decideClassificationStatus(
      resolved,
      input.minimumConfidence,
    );

    await input.repository.completeTask({
      taskId: task.id,
      status,
      resolved,
      rawResult: {
        provider: providerResult,
        issues: resolved.issues,
      },
    });

    return status;
  } catch (error) {
    const outcome = await input.repository.retryOrFailTask({
      taskId: task.id,
      maxAttempts: input.maxAttempts,
      retryDelaySeconds: classificationRetryDelaySeconds(
        task.attempts,
        retryBaseSeconds,
        retryMaxSeconds,
      ),
      message:
        error instanceof Error
          ? error.message.slice(0, 1_000)
          : "Unknown classification failure.",
    });

    return outcome === "FAILED" ? "FAILED" : "RETRIED";
  }
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]!);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, items.length) },
      () => worker(),
    ),
  );

  return results;
}

export async function processClassificationQueue(
  input: ProcessClassificationQueueInput,
): Promise<ProcessClassificationQueueOutput> {
  assertIntegerInRange("Classification limit", input.limit, 1, 10_000);
  assertIntegerInRange("Classification concurrency", input.concurrency, 1, 16);
  assertIntegerInRange("Classification maxAttempts", input.maxAttempts, 1, 20);
  assertIntegerInRange("Classification staleMinutes", input.staleMinutes, 1, 1_440);

  if (
    !Number.isFinite(input.minimumConfidence) ||
    input.minimumConfidence < 0 ||
    input.minimumConfidence > 1
  ) {
    throw new Error("Classification minimumConfidence must be between 0 and 1.");
  }

  const retryBaseSeconds = input.retryBaseSeconds ?? 60;
  const retryMaxSeconds = input.retryMaxSeconds ?? 3_600;

  const recovered = await input.repository.recoverStaleTasks(
    input.staleMinutes,
  );

  const tasks = await input.repository.claimTasks({
    limit: input.limit,
    classifierVersion: input.classifier.version,
    taxonomyVersion: input.taxonomy.version,
  });

  const outcomes = await mapWithConcurrency(
    tasks,
    input.concurrency,
    (task) => processOne(input, task, retryBaseSeconds, retryMaxSeconds),
  );

  const count = (outcome: Outcome) =>
    outcomes.filter((value) => value === outcome).length;

  return {
    recovered,
    claimed: tasks.length,
    completed: count("COMPLETED"),
    reviewRequired: count("REVIEW_REQUIRED"),
    retried: count("RETRIED"),
    failed: count("FAILED"),
  };
}
