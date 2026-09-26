import "dotenv/config";

import { processClassificationQueue } from "../src/modules/classification/application/process-classification-queue";
import {
  createQuestionClassifier,
  readMinimumConfidence,
} from "../src/modules/classification/infrastructure/create-question-classifier";
import { PrismaClassificationTaskRepository } from "../src/modules/classification/infrastructure/prisma-classification-task-repository";
import { getPrismaClient } from "../src/shared/infrastructure/database/prisma";

/*
 * Processes pending classification tasks. Only writes suggestions to
 * question_classification_tasks; questions are never changed here.
 *
 *   npm run classification:process -- --limit=500 --concurrency=4
 *   npm run classification:process -- --limit=500 --rpm=10   # free tiers
 *
 * The rate can also come from CLASSIFIER_REQUESTS_PER_MINUTE.
 */

function integerArgument(
  name: string,
  fallback: number,
): number {
  const prefix = `--${name}=`;
  const raw = process.argv
    .slice(2)
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);

  const value = raw === undefined ? fallback : Number(raw);

  if (!Number.isSafeInteger(value)) {
    throw new Error(`--${name} must be an integer.`);
  }

  return value;
}

function readRequestsPerMinute(): number | undefined {
  const prefix = "--rpm=";
  const raw =
    process.argv
      .slice(2)
      .find((argument) => argument.startsWith(prefix))
      ?.slice(prefix.length) ??
    process.env.CLASSIFIER_REQUESTS_PER_MINUTE;

  if (!raw?.trim()) {
    return undefined;
  }

  const value = Number(raw);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("--rpm must be a positive number.");
  }

  return value;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing from the environment.");
  }

  const prisma = getPrismaClient();

  try {
    const classifier = createQuestionClassifier();
    const repository = new PrismaClassificationTaskRepository(prisma);
    const taxonomy = await repository.loadTaxonomyIndex();

    const output = await processClassificationQueue({
      repository,
      classifier,
      taxonomy,
      limit: integerArgument("limit", 200),
      concurrency: integerArgument(
        "concurrency",
        classifier.provider === "rule-based" ? 8 : 2,
      ),
      maxAttempts: integerArgument("max-attempts", 5),
      staleMinutes: integerArgument("stale-minutes", 15),
      minimumConfidence: readMinimumConfidence(),
      requestsPerMinute: readRequestsPerMinute(),
    });

    console.log(
      JSON.stringify(
        {
          provider: classifier.provider,
          model: classifier.model,
          classifierVersion: classifier.version,
          taxonomyVersion: taxonomy.version,
          ...output,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
