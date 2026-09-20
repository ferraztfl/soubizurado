import "dotenv/config";

import {
  getPrismaClient,
} from "../src/shared/infrastructure/database/prisma";

function asRecord(
  value: unknown,
): Record<string, unknown> | null {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(
  value: unknown,
): readonly unknown[] {
  return Array.isArray(value)
    ? value
    : [];
}

function asText(
  value: unknown,
): string | null {
  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    const normalized =
      String(value).trim();

    return normalized || null;
  }

  return null;
}

function summarizeRawPayload(
  value: unknown,
): Record<string, unknown> {
  const payload = asRecord(value);

  if (!payload) {
    return {
      payloadType: typeof value,
    };
  }

  const classification =
    asRecord(payload.classificacao);
  const alternatives =
    asArray(payload.alternativas);
  const statement =
    asText(payload.enunciado) ?? "";

  const alternativeSummaries =
    alternatives.map((item) => {
      const alternative =
        asRecord(item);

      return {
        label: asText(
          alternative?.letra,
        ),
        contentLength:
          (
            asText(
              alternative?.texto,
            ) ?? ""
          ).length,
      };
    });

  return {
    keys: Object.keys(payload).sort(),
    answerKey:
      asText(payload.gabarito),
    discipline:
      asText(
        classification?.materia,
      ),
    topic:
      asText(
        classification?.assunto,
      ),
    statementLength:
      statement.length,
    alternativesCount:
      alternatives.length,
    alternatives:
      alternativeSummaries,
    proofsCount:
      asArray(payload.provas).length,
    firstProofType:
      (() => {
        const first =
          asArray(payload.provas)[0];

        if (Array.isArray(first)) {
          return "array";
        }

        if (first === null) {
          return "null";
        }

        return typeof first;
      })(),
  };
}

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
            rawPayload: true,
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
          job.items
            .slice(0, 10)
            .map((item) => ({
              externalId:
                item.externalId,
              status: item.status,
              failureReason:
                item.failureReason,
              questionId:
                item.questionId,
              diagnostics:
                summarizeRawPayload(
                  item.rawPayload,
                ),
            })),
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
