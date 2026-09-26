import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

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
  /** Why the last run ended (empty queue, quota, stop, error). */
  endReason: string | null;
}>;

const BATCH_SIZE = 20;

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

async function loop(current: MutableState): Promise<void> {
  try {
    current.enqueued = await enqueueUnclassifiedQuestions();

    while (true) {
      if (current.status === "STOPPING") {
        current.endReason = "Interrompida pelo administrador.";
        return;
      }

      const batch = await runClassificationBatch({ limit: BATCH_SIZE });

      current.processed += batch.completed + batch.reviewRequired + batch.failed;
      current.applied += batch.applied;
      current.answeredByRules += batch.answeredByRules;
      current.answeredByLocalAi += batch.answeredByLocalAi;
      current.reviewRequired += batch.reviewRequired;
      current.failed += batch.failed;

      if (batch.claimed === 0) {
        current.endReason = "Fila concluída.";
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

/** Starts a run unless one is active. Returns false when already running. */
export function startClassificationRun(): boolean {
  const current = state();

  if (current.status !== "IDLE") {
    return false;
  }

  Object.assign(current, {
    ...IDLE,
    status: "RUNNING",
    startedAt: new Date().toISOString(),
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
