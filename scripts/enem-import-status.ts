import "dotenv/config";

import {
  EnemDataProvider,
} from "../src/modules/imports/infrastructure/providers/enem-data-provider";
import {
  getPrismaClient,
} from "../src/shared/infrastructure/database/prisma";

type LatestItem = Readonly<{
  externalId: string;
  status:
    | "RECEIVED"
    | "IMPORTED"
    | "DUPLICATE"
    | "REVIEW_REQUIRED"
    | "FAILED";
  failureReason: string | null;
  updatedAt: Date;
}>;

function yearFromExternalId(
  externalId: string,
): number | null {
  const match =
    /^enem-(\d{4})-/.exec(
      externalId,
    );

  if (!match) {
    return null;
  }

  const year = Number(match[1]);

  return Number.isSafeInteger(year)
    ? year
    : null;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing from the environment.",
    );
  }

  const prisma = getPrismaClient();
  const provider =
    new EnemDataProvider();

  const years = (
    await provider.listAvailableYears()
  ).filter((year) => year >= 2009);

  const expectedCounts =
    new Map<number, number>();

  for (const year of years) {
    const page =
      await provider.listQuestions({
        limit: 1,
        examinationId:
          `enem-${year}`,
      });

    expectedCounts.set(
      year,
      page.total,
    );
  }

  const source =
    await prisma.questionSource.findUnique({
      where: {
        reference:
          "enem-api-yunger7",
      },
      select: {
        id: true,
      },
    });

  if (!source) {
    process.stdout.write(
      `${JSON.stringify(
        {
          sourceFound: false,
          years,
          message:
            "No ENEM source has been created in the local database yet.",
        },
        null,
        2,
      )}\n`,
    );

    return;
  }

  const [
    occurrences,
    jobs,
  ] = await Promise.all([
    prisma.questionOccurrence.findMany({
      where: {
        sourceId: source.id,
        externalExaminationId: {
          in: years.map(
            (year) =>
              `enem-${year}`,
          ),
        },
      },
      select: {
        externalId: true,
        externalExaminationId: true,
      },
    }),
    prisma.importJob.findMany({
      where: {
        sourceId: source.id,
        provider: "ENEM_DATA",
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        status: true,
        cursorStart: true,
        cursorEnd: true,
        receivedCount: true,
        importedCount: true,
        duplicateCount: true,
        reviewCount: true,
        failedCount: true,
        errorMessage: true,
        startedAt: true,
        finishedAt: true,
        createdAt: true,
        updatedAt: true,
        items: {
          orderBy: {
            updatedAt: "desc",
          },
          select: {
            externalId: true,
            status: true,
            failureReason: true,
            updatedAt: true,
          },
        },
      },
    }),
  ]);

  const persistedByYear =
    new Map<number, Set<string>>();

  for (const occurrence of occurrences) {
    const year =
      occurrence.externalExaminationId
        ? Number(
            occurrence.externalExaminationId.replace(
              /^enem-/,
              "",
            ),
          )
        : null;

    if (
      !year ||
      !Number.isSafeInteger(year)
    ) {
      continue;
    }

    const ids =
      persistedByYear.get(year) ??
      new Set<string>();

    ids.add(
      occurrence.externalId,
    );
    persistedByYear.set(
      year,
      ids,
    );
  }

  const latestItems =
    new Map<string, LatestItem>();

  for (const job of jobs) {
    for (const item of job.items) {
      const existing =
        latestItems.get(
          item.externalId,
        );

      if (
        !existing ||
        item.updatedAt >
          existing.updatedAt
      ) {
        latestItems.set(
          item.externalId,
          item,
        );
      }
    }
  }

  const perYear = years.map(
    (year) => {
      const expected =
        expectedCounts.get(year) ?? 0;
      const persisted =
        persistedByYear.get(year)
          ?.size ?? 0;

      const latestForYear = [
        ...latestItems.values(),
      ].filter(
        (item) =>
          yearFromExternalId(
            item.externalId,
          ) === year,
      );

      const seen =
        latestForYear.length;
      const reviewRequired =
        latestForYear.filter(
          (item) =>
            item.status ===
            "REVIEW_REQUIRED",
        ).length;
      const failed =
        latestForYear.filter(
          (item) =>
            item.status ===
            "FAILED",
        ).length;

      const reasonCounts =
        new Map<string, number>();

      for (const item of latestForYear) {
        if (!item.failureReason) {
          continue;
        }

        reasonCounts.set(
          item.failureReason,
          (reasonCounts.get(
            item.failureReason,
          ) ?? 0) + 1,
        );
      }

      return {
        year,
        expected,
        seen,
        persisted,
        reviewRequired,
        failed,
        unseen: Math.max(
          0,
          expected - seen,
        ),
        coveragePercent:
          expected > 0
            ? Number(
                (
                  (seen / expected) *
                  100
                ).toFixed(1),
              )
            : 0,
        reasons:
          Object.fromEntries(
            [...reasonCounts.entries()]
              .sort(
                (
                  first,
                  second,
                ) =>
                  second[1] -
                  first[1],
              ),
          ),
      };
    },
  );

  const expectedTotal =
    perYear.reduce(
      (sum, item) =>
        sum + item.expected,
      0,
    );
  const seenTotal =
    perYear.reduce(
      (sum, item) =>
        sum + item.seen,
      0,
    );
  const persistedTotal =
    perYear.reduce(
      (sum, item) =>
        sum + item.persisted,
      0,
    );
  const reviewTotal =
    perYear.reduce(
      (sum, item) =>
        sum +
        item.reviewRequired,
      0,
    );
  const failedTotal =
    perYear.reduce(
      (sum, item) =>
        sum + item.failed,
      0,
    );

  const latestJobs =
    jobs.slice(0, 12).map(
      (job) => {
        const firstExternalId =
          job.items[0]
            ?.externalId ?? null;
        const inferredYear =
          firstExternalId
            ? yearFromExternalId(
                firstExternalId,
              )
            : null;

        return {
          id: job.id,
          inferredYear,
          status: job.status,
          received:
            job.receivedCount,
          imported:
            job.importedCount,
          duplicates:
            job.duplicateCount,
          reviewRequired:
            job.reviewCount,
          failed:
            job.failedCount,
          cursorStart:
            job.cursorStart,
          cursorEnd:
            job.cursorEnd,
          errorMessage:
            job.errorMessage,
          startedAt:
            job.startedAt,
          finishedAt:
            job.finishedAt,
          updatedAt:
            job.updatedAt,
        };
      },
    );

  process.stdout.write(
    `${JSON.stringify(
      {
        sourceFound: true,
        summary: {
          years,
          expectedTotal,
          seenTotal,
          persistedTotal,
          reviewRequired:
            reviewTotal,
          failed: failedTotal,
          unseen: Math.max(
            0,
            expectedTotal -
              seenTotal,
          ),
          coveragePercent:
            expectedTotal > 0
              ? Number(
                  (
                    (seenTotal /
                      expectedTotal) *
                    100
                  ).toFixed(1),
                )
              : 0,
          runningJobs:
            jobs.filter(
              (job) =>
                job.status ===
                "RUNNING",
            ).length,
        },
        perYear,
        latestJobs,
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
      : "Unknown ENEM status error.";

  process.stderr.write(
    `ENEM status failed: ${message}\n`,
  );
  process.exitCode = 1;
});
