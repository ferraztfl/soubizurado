import "dotenv/config";

import { createQuestionClassifier } from "../src/modules/classification/infrastructure/create-question-classifier";
import { PrismaClassificationTaskRepository } from "../src/modules/classification/infrastructure/prisma-classification-task-repository";
import { getPrismaClient } from "../src/shared/infrastructure/database/prisma";

/*
 * Enqueues classification tasks for unclassified questions that are
 * still editable (DRAFT/IN_REVIEW) and belong to a knowledge area.
 * Idempotent per (question, classifier version, taxonomy version).
 *
 *   npm run classification:enqueue                 # dry-run
 *   npm run classification:enqueue -- --apply
 *   npm run classification:enqueue -- --apply --limit=200
 */

function argumentValue(name: string): string | undefined {
  const prefix = `--${name}=`;

  return process.argv
    .slice(2)
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length)
    .trim();
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing from the environment.");
  }

  const apply = process.argv.slice(2).includes("--apply");
  const limitArgument = argumentValue("limit");
  const limit = limitArgument ? Number(limitArgument) : undefined;

  if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1)) {
    throw new Error("--limit must be a positive integer.");
  }

  const prisma = getPrismaClient();

  try {
    const classifier = createQuestionClassifier();
    const repository = new PrismaClassificationTaskRepository(prisma);
    const taxonomy = await repository.loadTaxonomyIndex();

    const candidates = await prisma.question.findMany({
      where: {
        status: { in: ["DRAFT", "IN_REVIEW"] },
        topicId: null,
        knowledgeAreaId: { not: null },
        classificationTasks: {
          none: {
            classifierVersion: classifier.version,
            taxonomyVersion: taxonomy.version,
          },
        },
      },
      orderBy: { id: "asc" },
      take: limit,
      select: { id: true },
    });

    console.log(
      JSON.stringify(
        {
          mode: apply ? "apply" : "dry-run",
          provider: classifier.provider,
          model: classifier.model,
          classifierVersion: classifier.version,
          taxonomyVersion: taxonomy.version,
          questionsToEnqueue: candidates.length,
        },
        null,
        2,
      ),
    );

    if (!apply) {
      console.log("Dry-run only. Re-run with --apply to enqueue.");
      return;
    }

    const created = await repository.enqueue({
      questionIds: candidates.map((candidate) => candidate.id),
      provider: classifier.provider,
      model: classifier.model,
      classifierVersion: classifier.version,
      taxonomyVersion: taxonomy.version,
    });

    console.log(`Enqueued ${created} classification tasks.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
