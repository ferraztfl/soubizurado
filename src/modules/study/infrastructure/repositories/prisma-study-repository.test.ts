import type {
  PrismaClient,
} from "@/generated/prisma/client";

import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  PrismaStudyRepository,
} from "./prisma-study-repository";

function createPrismaMock() {
  const create = vi.fn();
  const findMany = vi.fn();
  const answerCount = vi.fn();

  const favoriteUpsert = vi.fn();
  const favoriteDeleteMany = vi.fn();
  const favoriteFindMany = vi.fn();
  const favoriteCount = vi.fn();

  const prisma = {
    studyAnswerAttempt: {
      create,
      findMany,
      count: answerCount,
    },
    studyFavorite: {
      upsert: favoriteUpsert,
      deleteMany: favoriteDeleteMany,
      findMany: favoriteFindMany,
      count: favoriteCount,
    },
  } as unknown as PrismaClient;

  return {
    prisma,
    create,
    findMany,
    answerCount,
    favoriteUpsert,
    favoriteDeleteMany,
    favoriteFindMany,
    favoriteCount,
  };
}

describe("PrismaStudyRepository", () => {
  it("persists a multiple-choice answer attempt", async () => {
    const answeredAt = new Date(
      "2026-09-08T18:00:00.000Z",
    );
    const { prisma, create } = createPrismaMock();

    create.mockResolvedValue({
      id: "attempt-1",
      profileId: "profile-1",
      questionId: "question-1",
      questionType: "MULTIPLE_CHOICE",
      selectedAlternativeId: "alternative-a",
      selectedTrueFalse: null,
      isCorrect: true,
      responseTimeMs: 4200,
      answeredAt,
    });

    const repository = new PrismaStudyRepository(
      prisma,
    );

    const result = await repository.createAnswerAttempt({
      profileId: "profile-1",
      questionId: "question-1",
      questionType: "MULTIPLE_CHOICE",
      selectedAlternativeId: "alternative-a",
      selectedTrueFalse: null,
      isCorrect: true,
      responseTimeMs: 4200,
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        profileId: "profile-1",
        questionId: "question-1",
        questionType: "MULTIPLE_CHOICE",
        selectedAlternativeId: "alternative-a",
        selectedTrueFalse: null,
        isCorrect: true,
        responseTimeMs: 4200,
      },
      select: {
        id: true,
        profileId: true,
        questionId: true,
        questionType: true,
        selectedAlternativeId: true,
        selectedTrueFalse: true,
        isCorrect: true,
        responseTimeMs: true,
        answeredAt: true,
      },
    });

    expect(result).toEqual({
      id: "attempt-1",
      profileId: "profile-1",
      questionId: "question-1",
      questionType: "MULTIPLE_CHOICE",
      selectedAlternativeId: "alternative-a",
      selectedTrueFalse: null,
      isCorrect: true,
      responseTimeMs: 4200,
      answeredAt,
    });
  });

  it("persists a True/False answer attempt", async () => {
    const answeredAt = new Date(
      "2026-09-08T18:05:00.000Z",
    );
    const { prisma, create } = createPrismaMock();

    create.mockResolvedValue({
      id: "attempt-2",
      profileId: "profile-1",
      questionId: "question-2",
      questionType: "TRUE_FALSE",
      selectedAlternativeId: null,
      selectedTrueFalse: false,
      isCorrect: false,
      responseTimeMs: null,
      answeredAt,
    });

    const repository = new PrismaStudyRepository(
      prisma,
    );

    const result = await repository.createAnswerAttempt({
      profileId: "profile-1",
      questionId: "question-2",
      questionType: "TRUE_FALSE",
      selectedAlternativeId: null,
      selectedTrueFalse: false,
      isCorrect: false,
      responseTimeMs: null,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          profileId: "profile-1",
          questionId: "question-2",
          questionType: "TRUE_FALSE",
          selectedAlternativeId: null,
          selectedTrueFalse: false,
          isCorrect: false,
          responseTimeMs: null,
        },
      }),
    );

    expect(result.selectedTrueFalse).toBe(false);
    expect(result.selectedAlternativeId).toBeNull();
  });

  it("lists answer history with correctness filtering", async () => {
    const { prisma, findMany, answerCount } =
      createPrismaMock();

    findMany.mockResolvedValue([]);
    answerCount.mockResolvedValue(0);

    const repository = new PrismaStudyRepository(
      prisma,
    );

    const result = await repository.listAnswerAttempts({
      profileId: "profile-1",
      offset: 20,
      limit: 10,
      isCorrect: false,
    });

    const where = {
      profileId: "profile-1",
      isCorrect: false,
    };

    expect(findMany).toHaveBeenCalledWith({
      where,
      skip: 20,
      take: 10,
      orderBy: [
        { answeredAt: "desc" },
        { id: "desc" },
      ],
      select: {
        id: true,
        profileId: true,
        questionId: true,
        questionType: true,
        selectedAlternativeId: true,
        selectedTrueFalse: true,
        isCorrect: true,
        responseTimeMs: true,
        answeredAt: true,
      },
    });

    expect(answerCount).toHaveBeenCalledWith({
      where,
    });
    expect(result).toEqual({
      items: [],
      total: 0,
    });
  });

  it("adds a favorite idempotently", async () => {
    const createdAt = new Date(
      "2026-09-19T18:00:00.000Z",
    );
    const { prisma, favoriteUpsert } =
      createPrismaMock();

    favoriteUpsert.mockResolvedValue({
      profileId: "profile-1",
      questionId: "question-1",
      createdAt,
    });

    const repository = new PrismaStudyRepository(
      prisma,
    );

    const result = await repository.setFavorite({
      profileId: "profile-1",
      questionId: "question-1",
      favorite: true,
    });

    expect(favoriteUpsert).toHaveBeenCalledWith({
      where: {
        profileId_questionId: {
          profileId: "profile-1",
          questionId: "question-1",
        },
      },
      create: {
        profileId: "profile-1",
        questionId: "question-1",
      },
      update: {},
      select: {
        profileId: true,
        questionId: true,
        createdAt: true,
      },
    });
    expect(result?.createdAt).toEqual(createdAt);
  });

  it("removes a favorite idempotently", async () => {
    const { prisma, favoriteDeleteMany } =
      createPrismaMock();

    favoriteDeleteMany.mockResolvedValue({
      count: 0,
    });

    const repository = new PrismaStudyRepository(
      prisma,
    );

    const result = await repository.setFavorite({
      profileId: "profile-1",
      questionId: "question-1",
      favorite: false,
    });

    expect(favoriteDeleteMany).toHaveBeenCalledWith({
      where: {
        profileId: "profile-1",
        questionId: "question-1",
      },
    });
    expect(result).toBeNull();
  });

  it("lists favorites with stable ordering", async () => {
    const createdAt = new Date(
      "2026-09-19T18:00:00.000Z",
    );
    const {
      prisma,
      favoriteFindMany,
      favoriteCount,
    } = createPrismaMock();

    favoriteFindMany.mockResolvedValue([
      {
        profileId: "profile-1",
        questionId: "question-1",
        createdAt,
      },
    ]);
    favoriteCount.mockResolvedValue(1);

    const repository = new PrismaStudyRepository(
      prisma,
    );

    const result = await repository.listFavorites({
      profileId: "profile-1",
      offset: 0,
      limit: 20,
    });

    const where = {
      profileId: "profile-1",
    };

    expect(favoriteFindMany).toHaveBeenCalledWith({
      where,
      skip: 0,
      take: 20,
      orderBy: [
        { createdAt: "desc" },
        { questionId: "asc" },
      ],
      select: {
        profileId: true,
        questionId: true,
        createdAt: true,
      },
    });
    expect(favoriteCount).toHaveBeenCalledWith({
      where,
    });
    expect(result.total).toBe(1);
    expect(result.items[0]?.questionId).toBe(
      "question-1",
    );
  });
});
