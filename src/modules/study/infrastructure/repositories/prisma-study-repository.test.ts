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

  const prisma = {
    studyAnswerAttempt: {
      create,
    },
  } as unknown as PrismaClient;

  return {
    prisma,
    create,
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
});
