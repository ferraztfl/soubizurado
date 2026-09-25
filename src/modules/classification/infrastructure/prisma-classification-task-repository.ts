import {
  Prisma,
  type PrismaClient,
} from "@/generated/prisma/client";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import type {
  ClaimedClassificationTask,
  ClassificationTaskRepository,
  CompleteClassificationTaskInput,
  EnqueueClassificationInput,
} from "../application/ports/classification-task-repository";
import type { QuestionClassificationInput } from "../domain/question-classifier";
import { TaxonomyIndex } from "../domain/taxonomy-index";

type ClaimedRow = Readonly<{
  id: string;
  question_id: string;
  attempts: number;
}>;

const ENQUEUE_BATCH_SIZE = 1_000;

export class PrismaClassificationTaskRepository
  implements ClassificationTaskRepository
{
  public constructor(
    private readonly prisma: PrismaClient = getPrismaClient(),
  ) {}

  public async loadTaxonomyIndex(): Promise<TaxonomyIndex> {
    const [revision, disciplines, areas, topics, subtopics] = await Promise.all([
      this.prisma.taxonomyRevision.findFirst({
        orderBy: { version: "desc" },
        select: { version: true },
      }),
      this.prisma.discipline.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          slug: true,
          knowledgeAreaId: true,
          aliases: { select: { name: true } },
        },
      }),
      this.prisma.area.findMany({
        where: { isActive: true },
        select: {
          id: true,
          disciplineId: true,
          name: true,
          aliases: { select: { name: true } },
        },
      }),
      this.prisma.topic.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          disciplineId: true,
          areaId: true,
          name: true,
          aliases: { select: { name: true } },
        },
      }),
      this.prisma.subtopic.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          topicId: true,
          name: true,
          aliases: { select: { name: true } },
        },
      }),
    ]);

    if (!revision) {
      throw new Error("No taxonomy revision found; run taxonomy:seed first.");
    }

    const names = (aliases: readonly { name: string }[]) =>
      aliases.map((alias) => alias.name);

    return new TaxonomyIndex({
      version: revision.version,
      disciplines: disciplines.map((row) => ({ ...row, aliases: names(row.aliases) })),
      areas: areas.map((row) => ({ ...row, aliases: names(row.aliases) })),
      topics: topics.map((row) => ({ ...row, aliases: names(row.aliases) })),
      subtopics: subtopics.map((row) => ({ ...row, aliases: names(row.aliases) })),
    });
  }

  public async recoverStaleTasks(staleMinutes: number): Promise<number> {
    return this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "question_classification_tasks"
        SET
          "status" = 'PENDING'::"QuestionClassificationStatus",
          "error_message" = COALESCE("error_message", 'Recovered stale PROCESSING task.'),
          "next_attempt_at" = NULL,
          "updated_at" = CURRENT_TIMESTAMP
        WHERE
          "status" = 'PROCESSING'::"QuestionClassificationStatus"
          AND "updated_at" < CURRENT_TIMESTAMP - (${staleMinutes} * INTERVAL '1 minute')
      `,
    );
  }

  public async claimTasks(
    input: Readonly<{
      limit: number;
      classifierVersion: string;
      taxonomyVersion: number;
    }>,
  ): Promise<readonly ClaimedClassificationTask[]> {
    const rows = await this.prisma.$queryRaw<ClaimedRow[]>(
      Prisma.sql`
        WITH picked AS (
          SELECT "id"
          FROM "question_classification_tasks"
          WHERE
            "status" = 'PENDING'::"QuestionClassificationStatus"
            AND "classifier_version" = ${input.classifierVersion}
            AND "taxonomy_version" = ${input.taxonomyVersion}
            AND ("next_attempt_at" IS NULL OR "next_attempt_at" <= CURRENT_TIMESTAMP)
          ORDER BY COALESCE("next_attempt_at", "created_at") ASC, "id" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT ${input.limit}
        )
        UPDATE "question_classification_tasks" AS task
        SET
          "status" = 'PROCESSING'::"QuestionClassificationStatus",
          "attempts" = task."attempts" + 1,
          "error_message" = NULL,
          "next_attempt_at" = NULL,
          "updated_at" = CURRENT_TIMESTAMP
        FROM picked
        WHERE task."id" = picked."id"
        RETURNING task."id", task."question_id", task."attempts"
      `,
    );

    return rows.map((row) => ({
      id: row.id,
      questionId: row.question_id,
      attempts: row.attempts,
    }));
  }

  public async loadQuestionInput(
    questionId: string,
  ): Promise<QuestionClassificationInput | null> {
    const question = await this.prisma.question.findFirst({
      where: {
        id: questionId,
        status: { in: ["DRAFT", "IN_REVIEW"] },
      },
      select: {
        id: true,
        statement: true,
        knowledgeAreaId: true,
        disciplineId: true,
        discipline: { select: { knowledgeAreaId: true } },
        supportLinks: {
          orderBy: { position: "asc" },
          select: { supportContent: { select: { content: true } } },
        },
        alternatives: {
          orderBy: { position: "asc" },
          select: { content: true },
        },
      },
    });

    if (!question) {
      return null;
    }

    return {
      questionId: question.id,
      statement: question.statement,
      supportTexts: question.supportLinks.map((link) => link.supportContent.content),
      alternatives: question.alternatives.map((alternative) => alternative.content),
      knowledgeAreaId: question.knowledgeAreaId,
      // Legacy ENEM disciplines have no knowledge area: not canonical.
      disciplineId: question.discipline?.knowledgeAreaId
        ? question.disciplineId
        : null,
    };
  }

  public async completeTask(input: CompleteClassificationTaskInput): Promise<void> {
    await this.prisma.questionClassificationTask.updateMany({
      where: { id: input.taskId, status: "PROCESSING" },
      data: {
        status: input.status,
        confidence: new Prisma.Decimal(input.resolved.confidence.toFixed(4)),
        suggestedDisciplineId: input.resolved.disciplineId,
        suggestedAreaId: input.resolved.areaId,
        suggestedTopicId: input.resolved.topicId,
        suggestedSubtopicId: input.resolved.subtopicId,
        suggestedTags: [...input.resolved.tags],
        rawResult: input.rawResult as Prisma.InputJsonValue,
        errorMessage: null,
        completedAt: new Date(),
      },
    });
  }

  public async retryOrFailTask(
    input: Readonly<{
      taskId: string;
      maxAttempts: number;
      retryDelaySeconds: number;
      message: string;
    }>,
  ): Promise<"PENDING" | "FAILED"> {
    const task = await this.prisma.questionClassificationTask.findUnique({
      where: { id: input.taskId },
      select: { attempts: true },
    });

    const exhausted = !task || task.attempts >= input.maxAttempts;

    await this.prisma.questionClassificationTask.updateMany({
      where: { id: input.taskId, status: "PROCESSING" },
      data: exhausted
        ? { status: "FAILED", errorMessage: input.message, nextAttemptAt: null }
        : {
            status: "PENDING",
            errorMessage: input.message,
            nextAttemptAt: new Date(Date.now() + input.retryDelaySeconds * 1_000),
          },
    });

    return exhausted ? "FAILED" : "PENDING";
  }

  public async failTask(
    input: Readonly<{ taskId: string; message: string }>,
  ): Promise<void> {
    await this.prisma.questionClassificationTask.updateMany({
      where: { id: input.taskId, status: "PROCESSING" },
      data: { status: "FAILED", errorMessage: input.message, nextAttemptAt: null },
    });
  }

  public async enqueue(input: EnqueueClassificationInput): Promise<number> {
    let created = 0;

    for (
      let index = 0;
      index < input.questionIds.length;
      index += ENQUEUE_BATCH_SIZE
    ) {
      const result = await this.prisma.questionClassificationTask.createMany({
        data: input.questionIds
          .slice(index, index + ENQUEUE_BATCH_SIZE)
          .map((questionId) => ({
            questionId,
            provider: input.provider,
            model: input.model,
            classifierVersion: input.classifierVersion,
            taxonomyVersion: input.taxonomyVersion,
          })),
        skipDuplicates: true,
      });

      created += result.count;
    }

    return created;
  }
}
