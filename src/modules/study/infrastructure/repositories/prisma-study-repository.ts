import type {
  PrismaClient,
} from "@/generated/prisma/client";

import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import type {
  ListStudyFavoritesRepositoryInput,
  ListStudyFavoritesRepositoryResult,
  SetStudyFavoriteRepositoryInput,
  StudyFavoriteRecord,
  StudyFavoriteRepository,
} from "../../application/ports/study-favorite-repository";
import type {
  ListStudyAnswerAttemptsRepositoryInput,
  ListStudyAnswerAttemptsRepositoryResult,
  StudyHistoryRepository,
} from "../../application/ports/study-history-repository";
import type {
  ListStudyIncorrectQuestionsRepositoryInput,
  ListStudyIncorrectQuestionsRepositoryResult,
  StudyIncorrectQuestionsRepository,
} from "../../application/ports/study-incorrect-questions-repository";
import type {
  CreateStudyAnswerAttemptInput,
  StudyAnswerAttemptRecord,
  StudyRepository,
} from "../../application/ports/study-repository";

const studyAnswerAttemptSelect = {
  id: true,
  profileId: true,
  questionId: true,
  questionType: true,
  selectedAlternativeId: true,
  selectedTrueFalse: true,
  isCorrect: true,
  responseTimeMs: true,
  answeredAt: true,
} as const;

const studyFavoriteSelect = {
  profileId: true,
  questionId: true,
  createdAt: true,
} as const;

export class PrismaStudyRepository
  implements
    StudyRepository,
    StudyHistoryRepository,
    StudyFavoriteRepository,
    StudyIncorrectQuestionsRepository
{
  public constructor(
    private readonly prisma: PrismaClient = getPrismaClient(),
  ) {}

  public async createAnswerAttempt(
    input: CreateStudyAnswerAttemptInput,
  ): Promise<StudyAnswerAttemptRecord> {
    return this.prisma.studyAnswerAttempt.create({
      data: {
        profileId: input.profileId,
        questionId: input.questionId,
        questionType: input.questionType,
        selectedAlternativeId:
          input.selectedAlternativeId,
        selectedTrueFalse: input.selectedTrueFalse,
        isCorrect: input.isCorrect,
        responseTimeMs: input.responseTimeMs,
      },
      select: studyAnswerAttemptSelect,
    });
  }

  public async listAnswerAttempts(
    input: ListStudyAnswerAttemptsRepositoryInput,
  ): Promise<ListStudyAnswerAttemptsRepositoryResult> {
    const where = {
      profileId: input.profileId,
      ...(input.isCorrect === undefined
        ? {}
        : { isCorrect: input.isCorrect }),
    };

    const [items, total] = await Promise.all([
      this.prisma.studyAnswerAttempt.findMany({
        where,
        skip: input.offset,
        take: input.limit,
        orderBy: [
          { answeredAt: "desc" },
          { id: "desc" },
        ],
        select: studyAnswerAttemptSelect,
      }),
      this.prisma.studyAnswerAttempt.count({
        where,
      }),
    ]);

    return {
      items,
      total,
    };
  }

  public async listIncorrectQuestions(
    input: ListStudyIncorrectQuestionsRepositoryInput,
  ): Promise<ListStudyIncorrectQuestionsRepositoryResult> {
    type IncorrectQuestionRow = {
      question_id: string;
      last_incorrect_at: Date;
      incorrect_attempts: number;
    };

    type IncorrectQuestionCountRow = {
      total: number;
    };

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<IncorrectQuestionRow[]>`
        SELECT
          "question_id",
          MAX("answered_at") AS "last_incorrect_at",
          COUNT(*)::int AS "incorrect_attempts"
        FROM "study_answer_attempts"
        WHERE
          "profile_id" = ${input.profileId}::uuid
          AND "is_correct" = FALSE
        GROUP BY "question_id"
        ORDER BY
          "last_incorrect_at" DESC,
          "question_id" ASC
        OFFSET ${input.offset}
        LIMIT ${input.limit}
      `,
      this.prisma.$queryRaw<IncorrectQuestionCountRow[]>`
        SELECT
          COUNT(DISTINCT "question_id")::int AS "total"
        FROM "study_answer_attempts"
        WHERE
          "profile_id" = ${input.profileId}::uuid
          AND "is_correct" = FALSE
      `,
    ]);

    return {
      items: rows.map((row) => ({
        questionId: row.question_id,
        lastIncorrectAt: row.last_incorrect_at,
        incorrectAttempts: row.incorrect_attempts,
      })),
      total: countRows[0]?.total ?? 0,
    };
  }

  public async setFavorite(
    input: SetStudyFavoriteRepositoryInput,
  ): Promise<StudyFavoriteRecord | null> {
    if (!input.favorite) {
      await this.prisma.studyFavorite.deleteMany({
        where: {
          profileId: input.profileId,
          questionId: input.questionId,
        },
      });

      return null;
    }

    return this.prisma.studyFavorite.upsert({
      where: {
        profileId_questionId: {
          profileId: input.profileId,
          questionId: input.questionId,
        },
      },
      create: {
        profileId: input.profileId,
        questionId: input.questionId,
      },
      update: {},
      select: studyFavoriteSelect,
    });
  }

  public async listFavorites(
    input: ListStudyFavoritesRepositoryInput,
  ): Promise<ListStudyFavoritesRepositoryResult> {
    const where = {
      profileId: input.profileId,
    };

    const [items, total] = await Promise.all([
      this.prisma.studyFavorite.findMany({
        where,
        skip: input.offset,
        take: input.limit,
        orderBy: [
          { createdAt: "desc" },
          { questionId: "asc" },
        ],
        select: studyFavoriteSelect,
      }),
      this.prisma.studyFavorite.count({
        where,
      }),
    ]);

    return {
      items,
      total,
    };
  }
}
