import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  ListStudyFavoritesRepositoryInput,
  ListStudyFavoritesRepositoryResult,
  SetStudyFavoriteRepositoryInput,
  StudyFavoriteRecord,
  StudyFavoriteRepository,
} from "../ports/study-favorite-repository";
import {
  SetStudyQuestionFavoriteUseCase,
} from "./set-study-question-favorite";

class FakeStudyFavoriteRepository
  implements StudyFavoriteRepository
{
  public lastSetInput:
    | SetStudyFavoriteRepositoryInput
    | null = null;

  public setResult: StudyFavoriteRecord | null = {
    profileId: "profile-1",
    questionId: "question-1",
    createdAt: new Date(
      "2026-09-19T12:00:00.000Z",
    ),
  };

  public async setFavorite(
    input: SetStudyFavoriteRepositoryInput,
  ): Promise<StudyFavoriteRecord | null> {
    this.lastSetInput = input;
    return input.favorite ? this.setResult : null;
  }

  public async listFavorites(
    _input: ListStudyFavoritesRepositoryInput,
  ): Promise<ListStudyFavoritesRepositoryResult> {
    return {
      items: [],
      total: 0,
    };
  }
}

describe("SetStudyQuestionFavoriteUseCase", () => {
  it("adds a question to favorites", async () => {
    const repository =
      new FakeStudyFavoriteRepository();
    const useCase =
      new SetStudyQuestionFavoriteUseCase(
        repository,
      );

    const result = await useCase.execute({
      profileId: "  profile-1 ",
      questionId: " question-1  ",
      favorite: true,
    });

    expect(repository.lastSetInput).toEqual({
      profileId: "profile-1",
      questionId: "question-1",
      favorite: true,
    });
    expect(result.favorite).toBe(true);
    expect(result.createdAt).toEqual(
      new Date("2026-09-19T12:00:00.000Z"),
    );
  });

  it("removes a question from favorites idempotently", async () => {
    const repository =
      new FakeStudyFavoriteRepository();
    const useCase =
      new SetStudyQuestionFavoriteUseCase(
        repository,
      );

    const result = await useCase.execute({
      profileId: "profile-1",
      questionId: "question-1",
      favorite: false,
    });

    expect(repository.lastSetInput).toEqual({
      profileId: "profile-1",
      questionId: "question-1",
      favorite: false,
    });
    expect(result).toEqual({
      questionId: "question-1",
      favorite: false,
      createdAt: null,
    });
  });

  it("rejects invalid identifiers", async () => {
    const repository =
      new FakeStudyFavoriteRepository();
    const useCase =
      new SetStudyQuestionFavoriteUseCase(
        repository,
      );

    await expect(
      useCase.execute({
        profileId: "",
        questionId: "question-1",
        favorite: true,
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });

    expect(repository.lastSetInput).toBeNull();
  });
});
