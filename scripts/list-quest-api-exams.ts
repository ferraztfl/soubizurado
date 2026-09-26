import "dotenv/config";

import {
  QuestApiProvider,
} from "../src/modules/imports/infrastructure/providers/quest-api-provider";

function argumentValue(
  name: string,
): string | undefined {
  const prefix = `--${name}=`;

  return process.argv
    .slice(2)
    .find((argument) =>
      argument.startsWith(prefix),
    )
    ?.slice(prefix.length)
    .trim();
}

function parseLimit(): number {
  const raw =
    argumentValue("limit") ?? "10";
  const limit = Number(raw);

  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new Error(
      "--limit must be an integer between 1 and 100.",
    );
  }

  return limit;
}

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

  const result =
    await provider.listExaminations({
      limit: parseLimit(),
      year: argumentValue("ano"),
      board: argumentValue("banca"),
      organization:
        argumentValue("orgao"),
      careerPosition:
        argumentValue("cargo"),
    });

  const items = [...result.items].sort(
    (first, second) =>
      first.totalQuestions -
        second.totalQuestions ||
      first.externalId.localeCompare(
        second.externalId,
      ),
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        totalMatching: result.total,
        returned: items.length,
        correlationId:
          result.correlationId,
        items,
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
      : "Unknown Quest API exam discovery error.";

  process.stderr.write(
    `Quest API exam discovery failed: ${message}\n`,
  );
  process.exitCode = 1;
});
