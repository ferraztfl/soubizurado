import "dotenv/config";

import {
  QuestApiProvider,
} from "../src/modules/imports/infrastructure/providers/quest-api-provider";

async function main(): Promise<void> {
  const apiKey =
    process.env.QUEST_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "QUEST_API_KEY is missing from the environment.",
    );
  }

  const provider = new QuestApiProvider({
    apiKey,
  });

  const quota = await provider.getQuota();

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        planCode: quota.planCode,
        used: quota.used,
        remaining: quota.remaining,
        quotaPerCycle:
          quota.quotaPerCycle,
        percentUsed:
          quota.percentUsed,
        periodStart:
          quota.periodStart,
        periodEnd:
          quota.periodEnd,
        unlimited:
          quota.unlimited,
        correlationId:
          quota.correlationId,
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : "Unknown Quest API preflight error.";

  process.stderr.write(
    `Quest API preflight failed: ${message}\n`,
  );
  process.exitCode = 1;
});
