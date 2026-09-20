import {
  Prisma,
  type PrismaClient,
} from "@/generated/prisma/client";
import {
  getPrismaClient,
} from "@/shared/infrastructure/database/prisma";

import type {
  ClaimedMediaTask,
  MediaTaskRepository,
  PersistedMediaAsset,
} from "../../application/ports/media-ingestion";

type ClaimedRow =
  Readonly<{
    id: string;
    import_item_id: string;
    question_id: string | null;
    source_url: string;
    role: string;
    alternative_label: string;
    position: number;
    attempts: number;
  }>;

function assetResult(
  value: Readonly<{
    id: string;
    checksum: string;
    storageProvider: string;
    bucket: string;
    storageKey: string;
    mimeType: string;
    sizeBytes: bigint;
  }>,
): PersistedMediaAsset {
  return value;
}

export class PrismaMediaTaskRepository
  implements MediaTaskRepository
{
  public constructor(
    private readonly prisma:
      PrismaClient =
        getPrismaClient(),
  ) {}

  public async recoverStaleTasks(
    staleMinutes: number,
  ): Promise<number> {
    if (
      !Number.isSafeInteger(
        staleMinutes,
      ) ||
      staleMinutes < 1
    ) {
      throw new Error(
        "staleMinutes must be a positive integer.",
      );
    }

    const result =
      await this.prisma.$executeRaw(
        Prisma.sql`
          UPDATE
            "import_media_tasks"
          SET
            "status" =
              'PENDING'::"ImportMediaTaskStatus",
            "error_message" =
              COALESCE(
                "error_message",
                'Recovered stale PROCESSING task.'
              ),
            "next_attempt_at" =
              NULL,
            "updated_at" =
              CURRENT_TIMESTAMP
          WHERE
            "status" =
              'PROCESSING'::"ImportMediaTaskStatus"
            AND
            "updated_at" <
              CURRENT_TIMESTAMP -
              (
                ${staleMinutes} *
                INTERVAL '1 minute'
              )
        `,
      );

    return result;
  }

  public async claimTasks(
    limit: number,
  ): Promise<
    readonly ClaimedMediaTask[]
  > {
    const rows =
      await this.prisma
        .$queryRaw<
          ClaimedRow[]
        >(
          Prisma.sql`
            WITH picked AS (
              SELECT
                "id"
              FROM
                "import_media_tasks"
              WHERE
                "status" =
                  'PENDING'::"ImportMediaTaskStatus"
                AND
                (
                  "next_attempt_at" IS NULL
                  OR
                  "next_attempt_at" <=
                    CURRENT_TIMESTAMP
                )
              ORDER BY
                COALESCE(
                  "next_attempt_at",
                  "created_at"
                ) ASC,
                "created_at" ASC,
                "id" ASC
              FOR UPDATE
                SKIP LOCKED
              LIMIT ${limit}
            )
            UPDATE
              "import_media_tasks" AS task
            SET
              "status" =
                'PROCESSING'::"ImportMediaTaskStatus",
              "attempts" =
                task."attempts" + 1,
              "error_message" =
                NULL,
              "next_attempt_at" =
                NULL,
              "updated_at" =
                CURRENT_TIMESTAMP
            FROM
              picked
            WHERE
              task."id" =
                picked."id"
            RETURNING
              task."id",
              task."import_item_id",
              task."question_id",
              task."source_url",
              task."role",
              task."alternative_label",
              task."position",
              task."attempts"
          `,
        );

    return rows.map(
      (row) => ({
        id:
          row.id,
        importItemId:
          row.import_item_id,
        questionId:
          row.question_id,
        sourceUrl:
          row.source_url,
        role:
          row.role,
        alternativeLabel:
          row.alternative_label,
        position:
          row.position,
        attempts:
          row.attempts,
      }),
    );
  }

  public async findAssetByChecksum(
    checksum: string,
  ): Promise<PersistedMediaAsset | null> {
    const asset =
      await this.prisma
        .mediaAsset
        .findUnique({
          where: {
            checksum,
          },
          select: {
            id: true,
            checksum: true,
            storageProvider: true,
            bucket: true,
            storageKey: true,
            mimeType: true,
            sizeBytes: true,
          },
        });

    return asset
      ? assetResult(asset)
      : null;
  }

  public async persistAsset(
    input: Readonly<{
      checksum: string;
      storageProvider: string;
      bucket: string;
      storageKey: string;
      mimeType: string;
      sizeBytes: bigint;
      sourceUrl: string;
    }>,
  ): Promise<PersistedMediaAsset> {
    const asset =
      await this.prisma
        .mediaAsset
        .upsert({
          where: {
            checksum:
              input.checksum,
          },
          update: {},
          create: {
            checksum:
              input.checksum,
            storageProvider:
              input.storageProvider,
            bucket:
              input.bucket,
            storageKey:
              input.storageKey,
            mimeType:
              input.mimeType,
            sizeBytes:
              input.sizeBytes,
            sourceUrl:
              input.sourceUrl,
          },
          select: {
            id: true,
            checksum: true,
            storageProvider: true,
            bucket: true,
            storageKey: true,
            mimeType: true,
            sizeBytes: true,
          },
        });

    return assetResult(
      asset,
    );
  }

  public async completeTask(
    input: Readonly<{
      task: ClaimedMediaTask;
      mediaAssetId: string;
    }>,
  ): Promise<void> {
    await this.prisma.$transaction(
      async (transaction) => {
        await transaction
          .importItemMediaLink
          .createMany({
            data: [
              {
                importItemId:
                  input.task
                    .importItemId,
                mediaAssetId:
                  input.mediaAssetId,
                role:
                  input.task.role,
                alternativeLabel:
                  input.task
                    .alternativeLabel,
                position:
                  input.task.position,
                page: null,
              },
            ],
            skipDuplicates: true,
          });

        if (
          input.task.questionId
        ) {
          if (
            input.task.role ===
            "ALTERNATIVE_IMAGE"
          ) {
            const alternative =
              await transaction
                .questionAlternative
                .findFirst({
                  where: {
                    questionId:
                      input.task
                        .questionId,
                    label:
                      input.task
                        .alternativeLabel,
                  },
                  select: {
                    id: true,
                  },
                });

            if (!alternative) {
              throw new Error(
                `Alternative ${input.task.alternativeLabel} not found for question ${input.task.questionId}.`,
              );
            }

            await transaction
              .questionAlternativeMediaLink
              .upsert({
                where: {
                  alternativeId_position: {
                    alternativeId:
                      alternative.id,
                    position:
                      input.task
                        .position,
                  },
                },
                update: {
                  mediaAssetId:
                    input.mediaAssetId,
                },
                create: {
                  alternativeId:
                    alternative.id,
                  mediaAssetId:
                    input.mediaAssetId,
                  position:
                    input.task
                      .position,
                },
              });
          } else {
            await transaction
              .questionMediaLink
              .upsert({
                where: {
                  questionId_role_position: {
                    questionId:
                      input.task
                        .questionId,
                    role:
                      input.task.role,
                    position:
                      input.task
                        .position,
                  },
                },
                update: {
                  mediaAssetId:
                    input.mediaAssetId,
                },
                create: {
                  questionId:
                    input.task
                      .questionId,
                  mediaAssetId:
                    input.mediaAssetId,
                  role:
                    input.task.role,
                  position:
                    input.task
                      .position,
                },
              });
          }
        }

        await transaction
          .importMediaTask
          .update({
            where: {
              id:
                input.task.id,
            },
            data: {
              status:
                "COMPLETED",
              mediaAssetId:
                input.mediaAssetId,
              errorMessage:
                null,
              nextAttemptAt:
                null,
            },
          });
      },
    );
  }

  public async retryOrFailTask(
    input: Readonly<{
      taskId: string;
      maxAttempts: number;
      retryDelaySeconds: number;
      message: string;
    }>,
  ): Promise<
    "PENDING" | "FAILED"
  > {
    if (
      !Number.isSafeInteger(
        input.retryDelaySeconds,
      ) ||
      input.retryDelaySeconds < 1
    ) {
      throw new Error(
        "retryDelaySeconds must be a positive integer.",
      );
    }

    const task =
      await this.prisma
        .importMediaTask
        .findUnique({
          where: {
            id:
              input.taskId,
          },
          select: {
            attempts: true,
          },
        });

    if (!task) {
      throw new Error(
        `Media task not found: ${input.taskId}.`,
      );
    }

    const finalFailure =
      task.attempts >=
      input.maxAttempts;

    const nextAttemptAt =
      finalFailure
        ? null
        : new Date(
            Date.now() +
              input.retryDelaySeconds *
                1000,
          );

    await this.prisma
      .importMediaTask
      .update({
        where: {
          id:
            input.taskId,
        },
        data: {
          status:
            finalFailure
              ? "FAILED"
              : "PENDING",
          nextAttemptAt,
          errorMessage:
            input.message.slice(
              0,
              4000,
            ),
        },
      });

    return finalFailure
      ? "FAILED"
      : "PENDING";
  }
}