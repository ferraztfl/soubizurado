import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import { budgetStopReason, estimateCostUsd, readClassificationBudget } from "./classification-budget";
import { createQuestionClassifier } from "./create-question-classifier";
import { PrismaClassificationTaskRepository } from "./prisma-classification-task-repository";
import { runClassificationBatch } from "./run-classification-batch";

/*
 * One background classification run per server process, started from
 * the backoffice button. It enqueues every unclassified question and
 * processes the queue in small batches (rules → AI, confident results
 * applied) until the queue is empty, the AI quota runs out or an admin
 * stops it.
 *
 * State lives in memory: fine for a long-running Node server (local or
 * VM). On serverless hosting a run would be cut short; the remaining
 * tasks simply stay queued for the next run or classification:process.
 */

export type ClassificationRunState = Readonly<{
  status: "IDLE" | "RUNNING" | "STOPPING";
  startedAt: string | null;
  finishedAt: string | null;
  enqueued: number;
  processed: number;
  applied: number;
  answeredByRules: number;
  answeredByLocalAi: number;
  reviewRequired: number;
  failed: number;
  /** Stop after this many processed questions (null = whole queue). */
  maxQuestions: number | null;
  remoteAiCalls: number;
  inputTokens: number;
  outputTokens: number;
  /** Estimated USD cost, null when prices are not configured. */
  estimatedCostUsd: number | null;
  /** Why the last run ended (empty queue, quota, stop, error). */
  endReason: string | null;
}>;

const BATCH_SIZE = 40;

type MutableState = { -readonly [Key in keyof ClassificationRunState]: ClassificationRunState[Key] };

const IDLE: MutableState = {
  status: "IDLE",
  startedAt: null,
  finishedAt: null,
  enqueued: 0,
  processed: 0,
  applied: 0,
  answeredByRules: 0,
  answeredByLocalAi: 0,
  reviewRequired: 0,
  failed: 0,
  maxQuestions: null,
  remoteAiCalls: 0,
  inputTokens: 0,
  outputTokens: 0,
  estimatedCostUsd: null,
  endReason: null,
};

// Kept on globalThis so dev hot reloads do not lose a running loop.
const holder = globalThis as typeof globalThis & { __classificationRun?: MutableState };

function state(): MutableState {
  holder.__classificationRun ??= { ...IDLE };
  return holder.__classificationRun;
}

export function getClassificationRunState(): ClassificationRunState {
  return { ...state() };
}

/** Enqueues unclassified, editable questions for the current classifier. */
export async function enqueueUnclassifiedQuestions(): Promise<number> {
  const prisma = getPrismaClient();
  const classifier = createQuestionClassifier();
  const repository = new PrismaClassificationTaskRepository(prisma);
  const taxonomy = await repository.loadTaxonomyIndex();

  const candidates = await prisma.question.findMany({
    where: {
      status: { in: ["DRAFT", "IN_REVIEW"] },
      topicId: null,
      knowledgeAreaId: { not: null },
      classificationTasks: {
        none: { classifierVersion: classifier.version, taxonomyVersion: taxonomy.version },
      },
    },
    select: { id: true },
  });

  if (candidates.length === 0) {
    return 0;
  }

  return repository.enqueue({
    questionIds: candidates.map((candidate) => candidate.id),
    provider: classifier.provider,
    model: classifier.model,
    classifierVersion: classifier.version,
    taxonomyVersion: taxonomy.version,
  });
}

const MAX_RETRY_WAIT_MS = 10 * 60_000;

/** Time until the earliest pending retry of this version, or null if none. */
async function millisecondsUntilNextRetry(classifierVersion: string): Promise<number | null> {
  const next = await getPrismaClient().questionClassificationTask.findFirst({
    where: { classifierVersion, status: "PENDING" },
    orderBy: { nextAttemptAt: "asc" },
    select: { nextAttemptAt: true },
  });

  if (!next) {
    return null;
  }

  return next.nextAttemptAt ? next.nextAttemptAt.getTime() - Date.now() : 0;
}

async function loop(current: MutableState): Promise<void> {
  try {
    const budget = readClassificationBudget();
    current.enqueued = await enqueueUnclassifiedQuestions();

    while (true) {
      if (current.status === "STOPPING") {
        current.endReason = "Interrompida pelo administrador.";
        return;
      }

      const budgetReason = budgetStopReason(budget, current);

      if (budgetReason) {
        current.endReason = budgetReason;
        return;
      }

      const remaining = current.maxQuestions === null ? BATCH_SIZE : current.maxQuestions - current.processed;

      if (remaining <= 0) {
        current.endReason = `Limite de ${current.maxQuestions} questões desta execução atingido.`;
        return;
      }

      const batch = await runClassificationBatch({
        limit: Math.min(BATCH_SIZE, remaining, budget.maxAiCallsPerRun - current.remoteAiCalls),
      });

      current.processed += batch.completed + batch.reviewRequired + batch.failed;
      current.applied += batch.applied;
      current.answeredByRules += batch.answeredByRules;
      current.answeredByLocalAi += batch.answeredByLocalAi;
      current.reviewRequired += batch.reviewRequired;
      current.failed += batch.failed;
      current.remoteAiCalls += batch.remoteAiCalls;
      current.inputTokens += batch.inputTokens;
      current.outputTokens += batch.outputTokens;
      current.estimatedCostUsd = estimateCostUsd(budget, current);

      if (batch.claimed === 0) {
        // Transient failures (e.g. "fetch failed") are retried with a
        // backoff: wait for them instead of ending with work left.
        const waitMs = await millisecondsUntilNextRetry(batch.classifierVersion);

        if (waitMs !== null && waitMs <= MAX_RETRY_WAIT_MS) {
          await new Promise((resolve) => setTimeout(resolve, Math.max(waitMs, 1_000)));
          continue;
        }

        current.endReason = waitMs === null ? "Fila concluída." : "Restam tarefas com nova tentativa agendada para mais tarde.";
        return;
      }

      // Every remote call of the batch was rejected (typically HTTP 429):
      // the quota is over for now; retried tasks keep their backoff.
      if (batch.retried > 0 && batch.completed + batch.reviewRequired === 0) {
        current.endReason = "A IA recusou as chamadas (provável cota esgotada). Tente novamente mais tarde.";
        return;
      }
    }
  } catch (error) {
    current.endReason = `Erro: ${error instanceof Error ? error.message.slice(0, 200) : "desconhecido"}`;
  } finally {
    current.status = "IDLE";
    current.finishedAt = new Date().toISOString();
  }
}

/**
 * Starts a run unless one is active. Returns false when already running.
 * `maxQuestions` limits the run (e.g. a pilot of 50); null = all.
 */
export function startClassificationRun(maxQuestions: number | null = null): boolean {
  const current = state();

  if (current.status !== "IDLE") {
    return false;
  }

  Object.assign(current, {
    ...IDLE,
    status: "RUNNING",
    startedAt: new Date().toISOString(),
    maxQuestions,
  });

  // Detached on purpose: the request returns while the run continues.
  void loop(current);

  return true;
}

/** Asks the active run to stop after the current batch. */
export function stopClassificationRun(): void {
  const current = state();

  if (current.status === "RUNNING") {
    current.status = "STOPPING";
  }
}
