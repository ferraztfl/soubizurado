import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import {
  processClassificationQueue,
  type ProcessClassificationQueueOutput,
} from "../application/process-classification-queue";

import {
  createQuestionClassifier,
  readAutoApply,
  readMinimumConfidence,
} from "./create-question-classifier";
import { PrismaClassificationTaskRepository } from "./prisma-classification-task-repository";

export type ClassificationBatchResult = ProcessClassificationQueueOutput &
  Readonly<{
    provider: string;
    model: string | null;
    classifierVersion: string;
    taxonomyVersion: number;
  }>;

/** Default pace for remote calls when nothing is configured (free tiers). */
const DEFAULT_REQUESTS_PER_MINUTE = 4;

export function readRequestsPerMinute(
  value: string | undefined = process.env.CLASSIFIER_REQUESTS_PER_MINUTE,
): number {
  if (!value?.trim()) {
    return DEFAULT_REQUESTS_PER_MINUTE;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("CLASSIFIER_REQUESTS_PER_MINUTE must be a positive number.");
  }

  return parsed;
}

/** Parallel AI calls (CLASSIFIER_CONCURRENCY, 1..16; default 1 for free tiers). */
export function readConcurrency(
  value: string | undefined = process.env.CLASSIFIER_CONCURRENCY,
): number {
  if (!value?.trim()) {
    return 1;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 16) {
    throw new Error("CLASSIFIER_CONCURRENCY must be an integer between 1 and 16.");
  }

  return parsed;
}

/**
 * Runs one batch of the classification pipeline (rules → AI) over due
 * tasks of the configured classifier version, auto-applying confident
 * results unless CLASSIFIER_AUTO_APPLY=false. Shared by the CLI and the
 * import center.
 */
export async function runClassificationBatch(
  input: Readonly<{
    limit: number;
    concurrency?: number;
    requestsPerMinute?: number;
    autoApply?: boolean;
  }>,
): Promise<ClassificationBatchResult> {
  const prisma = getPrismaClient();
  const classifier = createQuestionClassifier();
  const repository = new PrismaClassificationTaskRepository(prisma);
  const taxonomy = await repository.loadTaxonomyIndex();

  const output = await processClassificationQueue({
    repository,
    classifier,
    taxonomy,
    limit: input.limit,
    concurrency: input.concurrency ?? (classifier.provider === "rule-based" ? 8 : readConcurrency()),
    maxAttempts: 5,
    staleMinutes: 15,
    minimumConfidence: readMinimumConfidence(),
    requestsPerMinute: classifier.provider === "rule-based" ? undefined : input.requestsPerMinute ?? readRequestsPerMinute(),
    autoApply: input.autoApply ?? readAutoApply(),
  });

  return {
    provider: classifier.provider,
    model: classifier.model,
    classifierVersion: classifier.version,
    taxonomyVersion: taxonomy.version,
    ...output,
  };
}
