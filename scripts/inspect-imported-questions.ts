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

function preview(
  value: string,
  maxLength = 180,
): string {
  const normalized = value
    .replace(/\s+/g, " ")
    .trim();

  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, maxLength - 1)}…`;
}

async function main(): Promise<void> {
  const jobId = argumentValue("job");

  if (!jobId) {
    throw new Error(
      "--job=<uuid> is required.",
    );
  }

  const prisma = getPrismaClient();

  const job = await prisma.importJob.findUnique({
    where: {
      id: jobId,
    },
    select: {
      id: true,
      status: true,
      receivedCount: true,
      importedCount: true,
      duplicateCount: true,
      reviewCount: true,
      failedCount: true,
      items: {
        where: {
          status: "IMPORTED",
          questionId: {
            not: null,
          },
        },
        orderBy: {
          externalId: "asc",
        },
        select: {
          externalId: true,
          question: {
            select: {
              id: true,
              type: true,
              status: true,
              answerKeyStatus: true,
              statement: true,
              canonicalFingerprint: true,
              normalizationVersion: true,
              correctTrueFalse: true,
              discipline: {
                select: {
                  name: true,
                },
              },
              topic: {
                select: {
                  name: true,
                },
              },
              examination: {
                select: {
                  title: true,
                  year: true,
                  board: {
                    select: {
                      name: true,
                    },
                  },
                  organization: {
                    select: {
                      name: true,
                    },
                  },
                  careerPosition: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
              alternatives: {
                orderBy: {
                  position: "asc",
                },
                select: {
                  label: true,
                  content: true,
                  isCorrect: true,
                },
              },
              occurrences: {
                orderBy: {
                  capturedAt: "desc",
                },
                take: 5,
                select: {
                  externalId: true,
                  externalQuestionNumber: true,
                  externalExaminationId: true,
                  capturedAt: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!job) {
    throw new Error(
      `Import job ${jobId} was not found.`,
    );
  }

  const importedQuestions = job.items.flatMap(
    (item) => {
      if (!item.question) {
        return [];
      }

      return [{
        externalId: item.externalId,
        questionId: item.question.id,
        type: item.question.type,
        status: item.question.status,
        answerKeyStatus:
          item.question.answerKeyStatus,
        discipline:
          item.question.discipline?.name ??
          null,
        topic:
          item.question.topic?.name ?? null,
        statementPreview:
          preview(item.question.statement),
        canonicalFingerprint:
          item.question.canonicalFingerprint,
        normalizationVersion:
          item.question.normalizationVersion,
        correctTrueFalse:
          item.question.correctTrueFalse,
        alternatives:
          item.question.alternatives.map(
            (alternative) => ({
              label: alternative.label,
              contentPreview:
                preview(
                  alternative.content,
                  100,
                ),
              isCorrect:
                alternative.isCorrect,
            }),
          ),
        examination:
          item.question.examination
            ? {
                title:
                  item.question.examination.title,
                year:
                  item.question.examination.year,
                board:
                  item.question.examination.board
                    ?.name ?? null,
                organization:
                  item.question.examination
                    .organization?.name ??
                  null,
                careerPosition:
                  item.question.examination
                    .careerPosition?.name ??
                  null,
              }
            : null,
        occurrences:
          item.question.occurrences,
      }];
    },
  );

  const withoutTopic =
    importedQuestions.filter(
      (question) =>
        question.topic === null,
    ).length;

  process.stdout.write(
    `${JSON.stringify(
      {
        job: {
          id: job.id,
          status: job.status,
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
        },
        persistedQuestionCount:
          importedQuestions.length,
        withoutTopic,
        withTopic:
          importedQuestions.length -
          withoutTopic,
        sample:
          importedQuestions.slice(0, 5),
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
      : "Unknown persisted-question inspection error.";

  process.stderr.write(
    `Persisted-question inspection failed: ${message}\n`,
  );
  process.exitCode = 1;
});
