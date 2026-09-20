import {
  createHash,
} from "node:crypto";

import {
  Prisma,
  type PrismaClient,
} from "@/generated/prisma/client";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import type {
  ImportJobCounts,
  PersistImportedQuestionInput,
  PersistImportedQuestionResult,
  QuestionImportRepository,
  RecordImportReviewInput,
} from "../../application/ports/question-import-repository";
import type {
  ProviderExaminationMetadata,
} from "../../application/ports/question-provider";

export type QuestionImportSourceConfig =
  Readonly<{
    providerCode: string;
    reference: string;
    name: string;
    url: string | null;
    sourceType:
      | "OFFICIAL_EXAM"
      | "PROVIDER_API"
      | "ORIGINAL"
      | "LICENSED"
      | "OTHER";
    licenseStatus:
      | "UNKNOWN"
      | "PUBLIC_DOMAIN"
      | "AUTHORIZED"
      | "LICENSED"
      | "RESTRICTED";
    licenseName?: string | null;
    licenseNotes?: string | null;
  }>;

export const QUEST_API_SOURCE_CONFIG:
  QuestionImportSourceConfig = {
    providerCode: "QUEST_API",
    reference: "quest-api",
    name: "Quest API",
    url: "https://quest.api.br",
    sourceType: "PROVIDER_API",
    licenseStatus: "UNKNOWN",
    licenseName: null,
    licenseNotes:
      "Imported through authenticated provider API; preserve source provenance for every occurrence.",
  };

const FUZZY_DUPLICATE_THRESHOLD = 0.92;

type DuplicateSimilarityRow = Readonly<{
  id: string;
  similarity: number;
}>;

function toInputJsonValue(
  value: unknown,
): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value),
  ) as Prisma.InputJsonValue;
}

function slugify(
  value: string,
  maxLength: number,
): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (normalized.length > 0) {
    return normalized.slice(0, maxLength);
  }

  return createHash("sha256")
    .update(value, "utf8")
    .digest("hex")
    .slice(0, Math.min(maxLength, 24));
}

function truncate(
  value: string,
  maxLength: number,
): string {
  return value.length <= maxLength
    ? value
    : value.slice(0, maxLength);
}

async function resolveExamination(
  transaction: Prisma.TransactionClient,
  metadata:
    | ProviderExaminationMetadata
    | null,
): Promise<string | null> {
  if (!metadata) {
    return null;
  }

  const board = metadata.board
    ? await transaction.examiningBoard.upsert({
        where: {
          slug: slugify(
            metadata.board,
            200,
          ),
        },
        update: {
          name: metadata.board,
        },
        create: {
          name: metadata.board,
          acronym: null,
          slug: slugify(
            metadata.board,
            200,
          ),
        },
        select: {
          id: true,
        },
      })
    : null;

  const organization =
    metadata.organization
      ? await transaction.publicOrganization.upsert(
          {
            where: {
              slug: slugify(
                metadata.organization,
                220,
              ),
            },
            update: {
              name: metadata.organization,
            },
            create: {
              name: metadata.organization,
              acronym: null,
              slug: slugify(
                metadata.organization,
                220,
              ),
            },
            select: {
              id: true,
            },
          },
        )
      : null;

  const careerPosition =
    metadata.careerPosition
      ? await transaction.careerPosition.upsert(
          {
            where: {
              slug: slugify(
                metadata.careerPosition,
                200,
              ),
            },
            update: {
              name: metadata.careerPosition,
            },
            create: {
              name: metadata.careerPosition,
              slug: slugify(
                metadata.careerPosition,
                200,
              ),
            },
            select: {
              id: true,
            },
          },
        )
      : null;

  const titleParts = [
    metadata.organization,
    metadata.careerPosition,
    metadata.year
      ? String(metadata.year)
      : null,
  ].filter(
    (value): value is string =>
      Boolean(value),
  );

  const title = truncate(
    metadata.title?.trim() ||
      (
        titleParts.length > 0
          ? titleParts.join(" - ")
          : `Prova importada ${metadata.externalId}`
      ),
    240,
  );

  const slug = truncate(
    `quest-api-${metadata.externalId}`,
    260,
  );

  const examination =
    await transaction.examination.upsert({
      where: {
        slug,
      },
      update: {
        title,
        year: metadata.year,
        boardId: board?.id ?? null,
        organizationId:
          organization?.id ?? null,
        careerPositionId:
          careerPosition?.id ?? null,
      },
      create: {
        title,
        slug,
        year: metadata.year,
        boardId: board?.id ?? null,
        organizationId:
          organization?.id ?? null,
        careerPositionId:
          careerPosition?.id ?? null,
      },
      select: {
        id: true,
      },
    });

  return examination.id;
}

async function resolveTaxonomy(
  transaction: Prisma.TransactionClient,
  disciplineName: string,
  topicName: string | null,
): Promise<Readonly<{
  disciplineId: string;
  topicId: string | null;
}>> {
  const disciplineSlug = slugify(
    disciplineName,
    180,
  );

  const discipline =
    await transaction.discipline.upsert({
      where: {
        slug: disciplineSlug,
      },
      update: {
        name: disciplineName,
        isActive: true,
      },
      create: {
        name: disciplineName,
        slug: disciplineSlug,
      },
      select: {
        id: true,
      },
    });

  if (!topicName) {
    return {
      disciplineId: discipline.id,
      topicId: null,
    };
  }

  const topicSlug = slugify(
    topicName,
    200,
  );

  const topic =
    await transaction.topic.upsert({
      where: {
        disciplineId_slug: {
          disciplineId:
            discipline.id,
          slug: topicSlug,
        },
      },
      update: {
        name: topicName,
        isActive: true,
      },
      create: {
        disciplineId:
          discipline.id,
        name: topicName,
        slug: topicSlug,
      },
      select: {
        id: true,
      },
    });

  return {
    disciplineId: discipline.id,
    topicId: topic.id,
  };
}

async function upsertImportItem(
  transaction: Prisma.TransactionClient,
  input: Readonly<{
    jobId: string;
    externalId: string;
    status:
      | "IMPORTED"
      | "DUPLICATE"
      | "REVIEW_REQUIRED"
      | "FAILED";
    rawPayload: unknown;
    payloadHash: string;
    questionId: string | null;
    failureReason: string | null;
  }>,
): Promise<Readonly<{
  id: string;
}>> {
  return transaction.importItem.upsert({
    where: {
      jobId_externalId: {
        jobId: input.jobId,
        externalId:
          input.externalId,
      },
    },
    update: {
      status: input.status,
      rawPayload:
        toInputJsonValue(
          input.rawPayload,
        ),
      payloadHash:
        input.payloadHash,
      questionId:
        input.questionId,
      failureReason:
        input.failureReason,
    },
    create: {
      jobId: input.jobId,
      externalId:
        input.externalId,
      status: input.status,
      rawPayload:
        toInputJsonValue(
          input.rawPayload,
        ),
      payloadHash:
        input.payloadHash,
      questionId:
        input.questionId,
      failureReason:
        input.failureReason,
    },
    select: {
      id: true,
    },
  });
}

export class PrismaQuestionImportRepository
  implements QuestionImportRepository
{
  public constructor(
    private readonly prisma: PrismaClient =
      getPrismaClient(),
    private readonly sourceConfig:
      QuestionImportSourceConfig =
        QUEST_API_SOURCE_CONFIG,
  ) {}

  public async ensureSource(): Promise<{
    id: string;
  }> {
    const source =
      this.sourceConfig;

    return this.prisma.questionSource.upsert({
      where: {
        reference:
          source.reference,
      },
      update: {
        name: source.name,
        url: source.url,
        sourceType:
          source.sourceType,
        licenseStatus:
          source.licenseStatus,
        licenseName:
          source.licenseName ?? null,
        licenseNotes:
          source.licenseNotes ?? null,
      },
      create: {
        sourceType:
          source.sourceType,
        name: source.name,
        reference:
          source.reference,
        url: source.url,
        licenseStatus:
          source.licenseStatus,
        licenseName:
          source.licenseName ?? null,
        licenseNotes:
          source.licenseNotes ?? null,
      },
      select: {
        id: true,
      },
    });
  }

  public async createJob(
    input: Readonly<{
      sourceId: string;
      requestedLimit: number;
      cursorStart: string | null;
    }>,
  ): Promise<{
    id: string;
  }> {
    return this.prisma.importJob.create({
      data: {
        sourceId: input.sourceId,
        provider:
          this.sourceConfig.providerCode,
        status: "RUNNING",
        requestedLimit:
          input.requestedLimit,
        cursorStart:
          input.cursorStart,
        startedAt: new Date(),
      },
      select: {
        id: true,
      },
    });
  }

  public async persistQuestion(
    input: PersistImportedQuestionInput,
  ): Promise<PersistImportedQuestionResult> {
    return this.prisma.$transaction(
      async (transaction) => {
        const existingOccurrence =
          await transaction.questionOccurrence.findUnique(
            {
              where: {
                sourceId_externalId: {
                  sourceId:
                    input.sourceId,
                  externalId:
                    input.externalId,
                },
              },
              select: {
                questionId: true,
              },
            },
          );

        if (existingOccurrence) {
          await upsertImportItem(
            transaction,
            {
              jobId: input.jobId,
              externalId:
                input.externalId,
              status: "DUPLICATE",
              rawPayload:
                input.rawPayload,
              payloadHash:
                input.payloadHash,
              questionId:
                existingOccurrence.questionId,
              failureReason:
                "SOURCE_OCCURRENCE_ALREADY_IMPORTED",
            },
          );

          return {
            status: "DUPLICATE",
            questionId:
              existingOccurrence.questionId,
          };
        }

        const examinationId =
          await resolveExamination(
            transaction,
            input.examination,
          );

        const exactQuestion =
          await transaction.question.findUnique(
            {
              where: {
                canonicalFingerprint:
                  input.canonicalFingerprint,
              },
              select: {
                id: true,
              },
            },
          );

        if (exactQuestion) {
          await transaction.questionOccurrence.create(
            {
              data: {
                questionId:
                  exactQuestion.id,
                sourceId:
                  input.sourceId,
                examinationId,
                externalId:
                  input.externalId,
                externalQuestionNumber:
                  input.externalQuestionNumber,
                externalExaminationId:
                  input.externalExaminationId,
                sourceUrl:
                  input.sourceUrl,
              },
            },
          );

          await upsertImportItem(
            transaction,
            {
              jobId: input.jobId,
              externalId:
                input.externalId,
              status: "DUPLICATE",
              rawPayload:
                input.rawPayload,
              payloadHash:
                input.payloadHash,
              questionId:
                exactQuestion.id,
              failureReason:
                "CANONICAL_FINGERPRINT_MATCH",
            },
          );

          return {
            status: "DUPLICATE",
            questionId:
              exactQuestion.id,
          };
        }

        const possibleDuplicates =
          await transaction.$queryRaw<
            DuplicateSimilarityRow[]
          >(
            Prisma.sql`
              SELECT
                "id",
                similarity(
                  lower("statement"),
                  lower(${input.statement})
                )::double precision
                  AS "similarity"
              FROM "questions"
              WHERE
                similarity(
                  lower("statement"),
                  lower(${input.statement})
                ) >=
                  ${FUZZY_DUPLICATE_THRESHOLD}
              ORDER BY
                "similarity" DESC,
                "id" ASC
              LIMIT 5
            `,
          );

        if (
          possibleDuplicates.length > 0
        ) {
          const importItem =
            await upsertImportItem(
              transaction,
              {
                jobId: input.jobId,
                externalId:
                  input.externalId,
                status:
                  "REVIEW_REQUIRED",
                rawPayload:
                  input.rawPayload,
                payloadHash:
                  input.payloadHash,
                questionId: null,
                failureReason:
                  "POSSIBLE_DUPLICATE",
              },
            );

          await transaction.importDuplicateCandidate.createMany(
            {
              data:
                possibleDuplicates.map(
                  (candidate) => ({
                    importItemId:
                      importItem.id,
                    candidateQuestionId:
                      candidate.id,
                    similarity:
                      candidate.similarity,
                    reason:
                      "STATEMENT_TRIGRAM_SIMILARITY",
                  }),
                ),
              skipDuplicates: true,
            },
          );

          return {
            status:
              "REVIEW_REQUIRED",
            questionId: null,
            reason:
              "POSSIBLE_DUPLICATE",
          };
        }

        const taxonomy =
          await resolveTaxonomy(
            transaction,
            input.disciplineName,
            input.topicName,
          );

        const question =
          await transaction.question.create({
            data: {
              type: input.type,
              status: input.status,
              answerKeyStatus:
                input.answerKeyStatus,
              statement:
                input.statement,
              contentHash:
                input.contentHash,
              canonicalFingerprint:
                input.canonicalFingerprint,
              normalizationVersion:
                input.normalizationVersion,
              correctTrueFalse:
                input.correctTrueFalse,
              sourceId:
                input.sourceId,
              examinationId,
              disciplineId:
                taxonomy.disciplineId,
              topicId:
                taxonomy.topicId,
              publishedAt:
                input.status ===
                "PUBLISHED"
                  ? new Date()
                  : null,
              alternatives:
                input.alternatives.length > 0
                  ? {
                      create:
                        input.alternatives.map(
                          (
                            alternative,
                          ) => ({
                            label:
                              alternative.label,
                            content:
                              alternative.content,
                            position:
                              alternative.position,
                            isCorrect:
                              alternative.isCorrect,
                          }),
                        ),
                    }
                  : undefined,
            },
            select: {
              id: true,
            },
          });

        for (
          const support of
          input.supportContents
        ) {
          const supportContent =
            await transaction.questionSupportContent.upsert(
              {
                where: {
                  contentHash:
                    support.contentHash,
                },
                update: {},
                create: {
                  content:
                    support.content,
                  contentHash:
                    support.contentHash,
                },
                select: {
                  id: true,
                },
              },
            );

          await transaction.questionSupportLink.create(
            {
              data: {
                questionId:
                  question.id,
                supportContentId:
                  supportContent.id,
                position:
                  support.position,
              },
            },
          );
        }

        await transaction.questionOccurrence.create(
          {
            data: {
              questionId:
                question.id,
              sourceId:
                input.sourceId,
              examinationId,
              externalId:
                input.externalId,
              externalQuestionNumber:
                input.externalQuestionNumber,
              externalExaminationId:
                input.externalExaminationId,
              sourceUrl:
                input.sourceUrl,
            },
          },
        );

        await upsertImportItem(
          transaction,
          {
            jobId: input.jobId,
            externalId:
              input.externalId,
            status: "IMPORTED",
            rawPayload:
              input.rawPayload,
            payloadHash:
              input.payloadHash,
            questionId:
              question.id,
            failureReason: null,
          },
        );

        return {
          status: "IMPORTED",
          questionId:
            question.id,
        };
      },
    );
  }

  public async recordReview(
    input: RecordImportReviewInput,
  ): Promise<void> {
    await this.prisma.$transaction(
      async (transaction) => {
        await upsertImportItem(
          transaction,
          {
            jobId: input.jobId,
            externalId:
              input.externalId,
            status: "REVIEW_REQUIRED",
            rawPayload:
              input.rawPayload,
            payloadHash:
              input.payloadHash,
            questionId: null,
            failureReason:
              input.reason,
          },
        );
      },
    );
  }

  public async recordFailure(
    input: RecordImportReviewInput,
  ): Promise<void> {
    await this.prisma.$transaction(
      async (transaction) => {
        await upsertImportItem(
          transaction,
          {
            jobId: input.jobId,
            externalId:
              input.externalId,
            status: "FAILED",
            rawPayload:
              input.rawPayload,
            payloadHash:
              input.payloadHash,
            questionId: null,
            failureReason:
              input.reason,
          },
        );
      },
    );
  }

  public async completeJob(
    input: Readonly<{
      jobId: string;
      cursorEnd: string | null;
      counts: ImportJobCounts;
    }>,
  ): Promise<void> {
    await this.prisma.importJob.update({
      where: {
        id: input.jobId,
      },
      data: {
        status:
          input.counts.failed > 0
            ? "PARTIAL"
            : "COMPLETED",
        cursorEnd:
          input.cursorEnd,
        receivedCount:
          input.counts.received,
        importedCount:
          input.counts.imported,
        duplicateCount:
          input.counts.duplicates,
        reviewCount:
          input.counts.reviewRequired,
        failedCount:
          input.counts.failed,
        finishedAt: new Date(),
      },
    });
  }

  public async failJob(
    input: Readonly<{
      jobId: string;
      message: string;
    }>,
  ): Promise<void> {
    await this.prisma.importJob.update({
      where: {
        id: input.jobId,
      },
      data: {
        status: "FAILED",
        errorMessage:
          input.message,
        finishedAt: new Date(),
      },
    });
  }
}


export function createConfiguredQuestionImportRepository(
  sourceConfig: QuestionImportSourceConfig,
): PrismaQuestionImportRepository {
  return new PrismaQuestionImportRepository(
    getPrismaClient(),
    sourceConfig,
  );
}
