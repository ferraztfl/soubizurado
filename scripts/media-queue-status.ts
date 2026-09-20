import "dotenv/config";

import {
  getPrismaClient,
} from "../src/shared/infrastructure/database/prisma";

function argumentValue(
  name: string,
): string | undefined {
  const prefix =
    `--${name}=`;

  return process.argv
    .slice(2)
    .find((argument) =>
      argument.startsWith(
        prefix,
      ),
    )
    ?.slice(
      prefix.length,
    )
    .trim();
}

function parseLatest(): number {
  const value =
    Number(
      argumentValue("latest") ??
        "20",
    );

  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > 100
  ) {
    throw new Error(
      "--latest must be between 1 and 100.",
    );
  }

  return value;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing from the environment.",
    );
  }

  const prisma =
    getPrismaClient();

  const groups =
    await prisma.importMediaTask.groupBy({
      by: ["status"],
      _count: {
        _all: true,
      },
    });

  const counts =
    Object.fromEntries(
      groups.map(
        (group) => [
          group.status,
          group._count._all,
        ],
      ),
    );

  const latest =
    await prisma.importMediaTask.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: parseLatest(),
      select: {
        id: true,
        status: true,
        role: true,
        alternativeLabel: true,
        position: true,
        attempts: true,
        sourceUrl: true,
        questionId: true,
        mediaAssetId: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
        importItem: {
          select: {
            externalId: true,
            job: {
              select: {
                provider: true,
                source: {
                  select: {
                    reference: true,
                  },
                },
              },
            },
          },
        },
      },
    });

  process.stdout.write(
    `${JSON.stringify(
      {
        counts: {
          PENDING:
            counts.PENDING ?? 0,
          PROCESSING:
            counts.PROCESSING ?? 0,
          COMPLETED:
            counts.COMPLETED ?? 0,
          FAILED:
            counts.FAILED ?? 0,
        },
        latest,
      },
      null,
      2,
    )}\n`,
  );
}

main().catch(
  (error: unknown) => {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown media queue status error.";

    process.stderr.write(
      `Media queue status failed: ${message}\n`,
    );

    process.exitCode = 1;
  },
);