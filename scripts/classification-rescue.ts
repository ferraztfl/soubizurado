import "dotenv/config";

import { processClassificationQueue } from "../src/modules/classification/application/process-classification-queue";
import type { QuestionClassifier } from "../src/modules/classification/domain/question-classifier";
import {
  createQuestionClassifier,
  readMinimumConfidence,
} from "../src/modules/classification/infrastructure/create-question-classifier";
import { PrismaClassificationTaskRepository } from "../src/modules/classification/infrastructure/prisma-classification-task-repository";
import {
  readConcurrency,
  readRequestsPerMinute,
} from "../src/modules/classification/infrastructure/run-classification-batch";
import { getPrismaClient } from "../src/shared/infrastructure/database/prisma";

/*
 * Rescue run for questions still unclassified after the normal pipeline:
 * every layer may choose among all disciplines of the question knowledge
 * area (the booklet section may have fixed the wrong discipline).
 * Confident results are applied (the discipline may change inside the
 * area); nothing is published.
 *
 *   npm run classification:rescue            # dry-run
 *   npm run classification:rescue -- --apply
 *
 * --enem: ENEM questions (board INEP) whose stored knowledge area may be
 * wrong (old imports took it from the booklet day): candidates are the
 * disciplines of every ENEM area, and a confident answer may move a
 * legacy question (no canonical discipline) to its correct area.
 *
 *   npm run classification:rescue -- --enem --apply
 *
 * --quest: Quest API imports still without a discipline. The Quest subject
 * is often too specific to map, so the importer guessed an area (or used
 * the default one): candidates are the disciplines of every active area.
 *
 *   npm run classification:rescue -- --quest --apply
 */

/** Knowledge areas that belong to public-service exams, not to ENEM. */
const NON_ENEM_AREAS = ["ciencias-juridicas", "tecnologia-da-informacao"];

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing from the environment.");
  }

  const apply = process.argv.includes("--apply");
  const enem = process.argv.includes("--enem");
  const quest = process.argv.includes("--quest");
  const prisma = getPrismaClient();

  try {
    const base = createQuestionClassifier();
    const classifier: QuestionClassifier = {
      provider: base.provider,
      model: base.model,
      // Distinct version: tasks of the normal run already exist.
      version: `${base.version}${enem ? "+enem" : quest ? "+all" : "+ka"}`.slice(0, 40),
      classify: (input, taxonomy, options) => base.classify(input, taxonomy, options),
    };

    const repository = new PrismaClassificationTaskRepository(prisma);
    const taxonomy = await repository.loadTaxonomyIndex();

    const widenAreaIds = enem || quest
      ? (
          await prisma.knowledgeArea.findMany({
            where: { isActive: true, ...(enem ? { slug: { notIn: NON_ENEM_AREAS } } : {}) },
            select: { id: true },
          })
        ).map((area) => area.id)
      : [];

    const candidates = await prisma.question.findMany({
      where: {
        status: "IN_REVIEW",
        topicId: null,
        ...(enem
          ? { examination: { board: { slug: "inep" } } }
          : quest
          ? { disciplineId: null, examination: { slug: { startsWith: "quest-api-" } } }
          : { OR: [{ knowledgeAreaId: { not: null } }, { discipline: { knowledgeAreaId: { not: null } } }] }),
        classificationTasks: { none: { classifierVersion: classifier.version, taxonomyVersion: taxonomy.version } },
      },
      select: { id: true },
    });

    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", classifierVersion: classifier.version, questions: candidates.length }, null, 2));

    if (!apply || candidates.length === 0) {
      if (!apply) console.log("Dry-run only. Re-run with --apply.");
      return;
    }

    await repository.enqueue({
      questionIds: candidates.map((candidate) => candidate.id),
      provider: classifier.provider,
      model: classifier.model,
      classifierVersion: classifier.version,
      taxonomyVersion: taxonomy.version,
    });

    const totals = { completed: 0, reviewRequired: 0, applied: 0, failed: 0, remoteAiCalls: 0, inputTokens: 0, outputTokens: 0 };

    for (;;) {
      const output = await processClassificationQueue({
        repository,
        classifier,
        taxonomy,
        limit: 40,
        concurrency: readConcurrency(),
        maxAttempts: 5,
        staleMinutes: 15,
        minimumConfidence: readMinimumConfidence(),
        requestsPerMinute: readRequestsPerMinute(),
        autoApply: true,
        ...(enem || quest ? { widenToKnowledgeAreas: widenAreaIds } : { widenToKnowledgeArea: true }),
      });

      totals.completed += output.completed;
      totals.reviewRequired += output.reviewRequired;
      totals.applied += output.applied;
      totals.failed += output.failed;
      totals.remoteAiCalls += output.remoteAiCalls;
      totals.inputTokens += output.inputTokens;
      totals.outputTokens += output.outputTokens;
      console.log(JSON.stringify(totals));

      if (output.claimed === 0) {
        break;
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
