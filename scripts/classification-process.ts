import "dotenv/config";

import {
  readRequestsPerMinute,
  runClassificationBatch,
} from "../src/modules/classification/infrastructure/run-classification-batch";
import { getPrismaClient } from "../src/shared/infrastructure/database/prisma";

/*
 * Processes pending classification tasks through the pipeline
 * (metadata → rules → AI). Confident results (status COMPLETED) are
 * applied to still-unclassified questions; the rest stay as
 * suggestions for the review screen. Nothing is ever published.
 *
 *   npm run classification:process -- --limit=500
 *   npm run classification:process -- --limit=500 --rpm=10
 *   npm run classification:process -- --limit=500 --no-auto-apply
 *
 * Defaults come from CLASSIFIER_REQUESTS_PER_MINUTE (4) and
 * CLASSIFIER_AUTO_APPLY (true). The rate applies to AI calls only.
 */

function integerArgument(name: string): number | undefined {
  const prefix = `--${name}=`;
  const raw = process.argv
    .slice(2)
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);

  if (raw === undefined) {
    return undefined;
  }

  const value = Number(raw);

  if (!Number.isSafeInteger(value)) {
    throw new Error(`--${name} must be an integer.`);
  }

  return value;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing from the environment.");
  }

  const rpm = process.argv
    .slice(2)
    .find((argument) => argument.startsWith("--rpm="))
    ?.slice("--rpm=".length);

  try {
    const result = await runClassificationBatch({
      limit: integerArgument("limit") ?? 200,
      concurrency: integerArgument("concurrency"),
      requestsPerMinute: rpm === undefined ? undefined : readRequestsPerMinute(rpm),
      autoApply: process.argv.includes("--no-auto-apply") ? false : undefined,
    });

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await getPrismaClient().$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
