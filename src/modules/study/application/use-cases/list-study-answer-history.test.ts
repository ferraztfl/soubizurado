import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  ListStudyAnswerAttemptsRepositoryInput,
  ListStudyAnswerAttemptsRepositoryResult,
  StudyHistoryRepository,
} from "../ports/study-history-repository";
import {
  ListStudyAnswerHistoryUseCase,
} from "./list-study-answer-history";

class FakeStudyHistoryRepository
  implements StudyHistoryRepository
{
  public lastInput:
    | ListStudyAnswerAttemptsRepositoryInput
    | null = null;

  public result:
    ListStudyAnswerAttemptsRepositoryResult = {
      items: [
        {
          id: "attempt-1",
          profileId: "profile-1",
          questionId: "question-1",
          questionType: "MULTIPLE_CHOICE",
          selectedAlternativeId: "alternative-a",
          selectedTrueFalse: null,
          isCorrect: false,
          responseTimeMs: 3200,
          answeredAt: new Date(
            "2026-09-19T12:00:00.000Z",
          ),
        },
      ],
      total: 1,
    };

  public async listAnswerAttempts(
    input: ListStudyAnswerAttemptsRepositoryInput,
  ): Promise<ListStudyAnswerAttemptsRepositoryResult> {
    this.lastInput = input;
    return this.result;
  }
}

describe("ListStudyAnswerHistoryUseCase", () => {
  it("uses bounded default pagination", async () => {
    const repository =
      new FakeStudyHistoryRepository();
    const useCase =
      new ListStudyAnswerHistoryUseCase(repository);

    const result = await useCase.execute({
      profileId: "  profile-1  ",
    });

    expect(repository.lastInput).toEqual({
      profileId: "profile-1",
      offset: 0,
      limit: 20,
    });
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it("filters incorrect attempts and applies pagination", async () => {
    const repository =
      new FakeStudyHistoryRepository();
    const useCase =
      new ListStudyAnswerHistoryUseCase(repository);

    await useCase.execute({
      profileId: "profile-1",
      page: 2,
      pageSize: 10,
      correctness: "INCORRECT",
    });

    expect(repository.lastInput).toEqual({
      profileId: "profile-1",
      offset: 10,
      limit: 10,
      isCorrect: false,
    });
  });

  it("rejects invalid input", async () => {
    const repository =
      new FakeStudyHistoryRepository();
    const useCase =
      new ListStudyAnswerHistoryUseCase(repository);

    await expect(
      useCase.execute({
        profileId: "   ",
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });

    await expect(
      useCase.execute({
        profileId: "profile-1",
        page: 0,
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });

    await expect(
      useCase.execute({
        profileId: "profile-1",
        pageSize: 51,
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });
});
