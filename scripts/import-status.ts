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
      argumentValue(
        "latest",
      ) ?? "20",
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

  const provider =
    argumentValue(
      "provider",
    );

  const where =
    provider
      ? {
          provider,
        }
      : {};

  const groups =
    await prisma.importJob.groupBy({
      by: [
        "sourceId",
        "provider",
        "status",
      ],
      where,
      _count: {
        _all: true,
      },
      _sum: {
        receivedCount: true,
        importedCount: true,
        duplicateCount: true,
        reviewCount: true,
        failedCount: true,
      },
    });

  const sourceIds = [
    ...new Set(
      groups.map(
        (group) =>
          group.sourceId,
      ),
    ),
  ];

  const sources =
    sourceIds.length > 0
      ? await prisma
          .questionSource
          .findMany({
            where: {
              id: {
                in: sourceIds,
              },
            },
            select: {
              id: true,
              reference: true,
              name: true,
            },
          })
      : [];

  const sourceById =
    new Map(
      sources.map(
        (source) => [
          source.id,
          source,
        ],
      ),
    );

  type Aggregate = {
    sourceId: string;
    provider: string;
    sourceReference:
      string | null;
    sourceName:
      string | null;
    jobs: number;
    received: number;
    imported: number;
    duplicates: number;
    reviewRequired: number;
    failed: number;
    statuses:
      Record<string, number>;
  };

  const aggregates =
    new Map<string, Aggregate>();

  for (const group of groups) {
    const key =
      `${group.sourceId}:${group.provider}`;

    const source =
      sourceById.get(
        group.sourceId,
      );

    const aggregate =
      aggregates.get(key) ?? {
        sourceId:
          group.sourceId,
        provider:
          group.provider,
        sourceReference:
          source?.reference ??
          null,
        sourceName:
          source?.name ??
          null,
        jobs: 0,
        received: 0,
        imported: 0,
        duplicates: 0,
        reviewRequired: 0,
        failed: 0,
        statuses: {},
      };

    const jobCount =
      group._count._all;

    aggregate.jobs +=
      jobCount;

    aggregate.received +=
      group._sum
        .receivedCount ?? 0;

    aggregate.imported +=
      group._sum
        .importedCount ?? 0;

    aggregate.duplicates +=
      group._sum
        .duplicateCount ?? 0;

    aggregate.reviewRequired +=
      group._sum
        .reviewCount ?? 0;

    aggregate.failed +=
      group._sum
        .failedCount ?? 0;

    aggregate.statuses[
      String(group.status)
    ] = jobCount;

    aggregates.set(
      key,
      aggregate,
    );
  }

  const latestJobs =
    await prisma.importJob.findMany({
      where,
      orderBy: {
        createdAt:
          "desc",
      },
      take:
        parseLatest(),
      select: {
        id: true,
        provider: true,
        status: true,
        cursorStart: true,
        cursorEnd: true,
        requestedLimit: true,
        receivedCount: true,
        importedCount: true,
        duplicateCount: true,
        reviewCount: true,
        failedCount: true,
        errorMessage: true,
        startedAt: true,
        finishedAt: true,
        source: {
          select: {
            reference: true,
            name: true,
          },
        },
      },
    });

  process.stdout.write(
    `${JSON.stringify(
      {
        filter: {
          provider:
            provider ??
            null,
        },
        sources: [
          ...aggregates
            .values(),
        ].sort(
          (first, second) =>
            first.provider.localeCompare(
              second.provider,
            ) ||
            (
              first.sourceReference ??
              ""
            ).localeCompare(
              second.sourceReference ??
              "",
            ),
        ),
        latestJobs,
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
        : "Unknown import status error.";

    process.stderr.write(
      `Import status failed: ${message}\n`,
    );

    process.exitCode = 1;
  },
);