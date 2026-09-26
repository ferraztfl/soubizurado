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
  /** Provider calls per minute across all workers (free-tier limits). */
  requestsPerMinute?: number;
  /**
   * Apply COMPLETED suggestions to still-unclassified questions right
   * away (through the repository, which enforces the same validation as
   * the review screen). Never publishes.
   */
  autoApply?: boolean;
  sleep?: (milliseconds: number) => Promise<void>;
}>;

export type ProcessClassificationQueueOutput = Readonly<{
  recovered: number;
  claimed: number;
  completed: number;
  reviewRequired: number;
  retried: number;
  failed: number;
  /** COMPLETED suggestions applied to their questions (autoApply). */
  applied: number;
  /** Answers produced by the rules layer, without a remote call. */
  answeredByRules: number;
  /** Answers produced by the local AI layer (e.g. Ollama). */
  answeredByLocalAi: number;
  /** Remote (billed) AI answers and the tokens they reported. */
  remoteAiCalls: number;
  inputTokens: number;
  outputTokens: number;
}>;

type Outcome = Readonly<{
  status: "COMPLETED" | "REVIEW_REQUIRED" | "RETRIED" | "FAILED";
  applied: boolean;
  layer: "RULES" | "LOCAL_AI" | "AI" | null;
  /** Billed tokens; null when the answer did not come from a remote AI. */
  usage: Readonly<{ inputTokens: number; outputTokens: number }> | null;
}>;

const failed: Outcome = { status: "FAILED", applied: false, layer: null, usage: null };

/**
 * Spaces provider calls evenly across concurrent workers: each call
 * reserves the next free slot, so N workers never exceed the rate.
 */
export function createRateLimiter(
  requestsPerMinute: number | undefined,
  sleep: (milliseconds: number) => Promise<void>,
  now: () => number = Date.now,
): () => Promise<void> {
  if (!requestsPerMinute) {
    return async () => {};
  }

  const intervalMs = 60_000 / requestsPerMinute;
  let nextSlot = 0;

  return async () => {
    const current = now();
    const slot = Math.max(current, nextSlot);
    nextSlot = slot + intervalMs;

    if (slot > current) {
      await sleep(slot - current);
    }
  };
}

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
  waitForSlot: () => Promise<void>,
): Promise<Outcome> {
  const question = await input.repository.loadQuestionInput(task.questionId);

  if (!question) {
    await input.repository.failTask({
      taskId: task.id,
      message: "Question is no longer available for classification.",
    });

    return failed;
  }

  let status: "COMPLETED" | "REVIEW_REQUIRED";
  let layer: Outcome["layer"];
  let usage: Outcome["usage"] = null;

  try {
    // The rate limit applies to remote calls only; local layers are free.
    const providerResult = await input.classifier.classify(
      question,
      input.taxonomy,
      { beforeRemoteCall: waitForSlot },
    );

    const resolved = resolveProviderClassification(
      input.taxonomy,
      question,
      providerResult,
    );

    status = decideClassificationStatus(
      resolved,
      input.minimumConfidence,
    );
    layer = providerResult.layer ?? null;
    // Rules and local answers are free even if they report tokens.
    usage =
      layer === "RULES" || layer === "LOCAL_AI"
        ? null
        : providerResult.usage ?? { inputTokens: 0, outputTokens: 0 };

    await input.repository.completeTask({
      taskId: task.id,
      status,
      resolved,
      rawResult: {
        provider: providerResult,
        issues: resolved.issues,
      },
    });
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

    return outcome === "FAILED"
      ? failed
      : { status: "RETRIED", applied: false, layer: null, usage: null };
  }

  // Applying is best effort: the suggestion stays stored if it fails.
  let applied = false;

  if (status === "COMPLETED" && input.autoApply) {
    try {
      applied = await input.repository.applySuggestion({
        taskId: task.id,
        questionId: task.questionId,
      });
    } catch {
      applied = false;
    }
  }

  return { status, applied, layer, usage };
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

  if (
    input.requestsPerMinute !== undefined &&
    (!Number.isFinite(input.requestsPerMinute) ||
      input.requestsPerMinute <= 0 ||
      input.requestsPerMinute > 10_000)
  ) {
    throw new Error("Classification requestsPerMinute must be between 0 and 10000.");
  }

  const waitForSlot = createRateLimiter(
    input.requestsPerMinute,
    input.sleep ??
      ((milliseconds) =>
        new Promise((resolve) => setTimeout(resolve, milliseconds))),
  );

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
    (task) =>
      processOne(input, task, retryBaseSeconds, retryMaxSeconds, waitForSlot),
  );

  const count = (status: Outcome["status"]) =>
    outcomes.filter((outcome) => outcome.status === status).length;

  return {
    recovered,
    claimed: tasks.length,
    completed: count("COMPLETED"),
    reviewRequired: count("REVIEW_REQUIRED"),
    retried: count("RETRIED"),
    failed: count("FAILED"),
    applied: outcomes.filter((outcome) => outcome.applied).length,
    answeredByRules: outcomes.filter((outcome) => outcome.layer === "RULES").length,
    answeredByLocalAi: outcomes.filter((outcome) => outcome.layer === "LOCAL_AI").length,
    remoteAiCalls: outcomes.filter((outcome) => outcome.usage !== null).length,
    inputTokens: outcomes.reduce((sum, outcome) => sum + (outcome.usage?.inputTokens ?? 0), 0),
    outputTokens: outcomes.reduce((sum, outcome) => sum + (outcome.usage?.outputTokens ?? 0), 0),
  };
}
