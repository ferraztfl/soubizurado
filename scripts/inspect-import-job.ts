import "dotenv/config";

import {
  getPrismaClient,
} from "../src/shared/infrastructure/database/prisma";

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

async function main(): Promise<void> {
  const jobId =
    argumentValue("job");

  if (!jobId) {
    throw new Error(
      "--job=<uuid> is required.",
    );
  }

  const prisma = getPrismaClient();

  const job =
    await prisma.importJob.findUnique({
      where: {
        id: jobId,
      },
      select: {
        id: true,
        provider: true,
        status: true,
        requestedLimit: true,
        receivedCount: true,
        importedCount: true,
        duplicateCount: true,
        reviewCount: true,
        failedCount: true,
        cursorStart: true,
        cursorEnd: true,
        errorMessage: true,
        startedAt: true,
        finishedAt: true,
        items: {
          orderBy: [
            {
              status: "asc",
            },
            {
              externalId: "asc",
            },
          ],
          select: {
            externalId: true,
            status: true,
            failureReason: true,
            questionId: true,
          },
        },
      },
    });

  if (!job) {
    throw new Error(
      `Import job ${jobId} was not found.`,
    );
  }

  const reasonCounts = new Map<
    string,
    number
  >();

  for (const item of job.items) {
    const key =
      item.failureReason ??
      item.status;

    reasonCounts.set(
      key,
      (reasonCounts.get(key) ?? 0) + 1,
    );
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        job: {
          id: job.id,
          provider: job.provider,
          status: job.status,
          requestedLimit:
            job.requestedLimit,
          receivedCount:
            job.receivedCount,
          importedCount:
            job.importedCount,
          duplicateCount:
            job.duplicateCount,
          reviewCount:
            job.reviewCount,
          failedCount:
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
        },
        reasonCounts:
          Object.fromEntries(
            [...reasonCounts.entries()]
              .sort(
                (first, second) =>
                  second[1] - first[1],
              ),
          ),
        sampleItems:
          job.items.slice(0, 10),
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
      : "Unknown import inspection error.";

  process.stderr.write(
    `Import inspection failed: ${message}\n`,
  );
  process.exitCode = 1;
});
