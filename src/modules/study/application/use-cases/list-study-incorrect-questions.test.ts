import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  ListStudyIncorrectQuestionsRepositoryInput,
  ListStudyIncorrectQuestionsRepositoryResult,
  StudyIncorrectQuestionsRepository,
} from "../ports/study-incorrect-questions-repository";
import {
  ListStudyIncorrectQuestionsUseCase,
} from "./list-study-incorrect-questions";

class FakeStudyIncorrectQuestionsRepository
  implements StudyIncorrectQuestionsRepository
{
  public lastInput:
    | ListStudyIncorrectQuestionsRepositoryInput
    | null = null;

  public result:
    ListStudyIncorrectQuestionsRepositoryResult = {
      items: [
        {
          questionId: "question-1",
          lastIncorrectAt: new Date(
            "2026-09-19T18:00:00.000Z",
          ),
          incorrectAttempts: 2,
        },
      ],
      total: 1,
    };

  public async listIncorrectQuestions(
    input: ListStudyIncorrectQuestionsRepositoryInput,
  ): Promise<ListStudyIncorrectQuestionsRepositoryResult> {
    this.lastInput = input;
    return this.result;
  }
}

describe("ListStudyIncorrectQuestionsUseCase", () => {
  it("lists unique incorrect questions with default pagination", async () => {
    const repository =
      new FakeStudyIncorrectQuestionsRepository();
    const useCase =
      new ListStudyIncorrectQuestionsUseCase(
        repository,
      );

    const result = await useCase.execute({
      profileId: "  profile-1  ",
    });

    expect(repository.lastInput).toEqual({
      profileId: "profile-1",
      offset: 0,
      limit: 20,
    });
    expect(result.items).toEqual(
      repository.result.items,
    );
    expect(result.totalPages).toBe(1);
  });

  it("applies requested pagination", async () => {
    const repository =
      new FakeStudyIncorrectQuestionsRepository();
    const useCase =
      new ListStudyIncorrectQuestionsUseCase(
        repository,
      );

    await useCase.execute({
      profileId: "profile-1",
      page: 2,
      pageSize: 10,
    });

    expect(repository.lastInput).toEqual({
      profileId: "profile-1",
      offset: 10,
      limit: 10,
    });
  });

  it("rejects invalid input", async () => {
    const repository =
      new FakeStudyIncorrectQuestionsRepository();
    const useCase =
      new ListStudyIncorrectQuestionsUseCase(
        repository,
      );

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
        pageSize: 51,
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });
});
