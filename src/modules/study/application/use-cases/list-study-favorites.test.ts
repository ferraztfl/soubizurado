import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  ListStudyFavoritesRepositoryInput,
  ListStudyFavoritesRepositoryResult,
  StudyFavoriteRecord,
  StudyFavoriteRepository,
} from "../ports/study-favorite-repository";
import {
  ListStudyFavoritesUseCase,
} from "./list-study-favorites";

class FakeStudyFavoriteRepository
  implements StudyFavoriteRepository
{
  public lastListInput:
    | ListStudyFavoritesRepositoryInput
    | null = null;

  public result:
    ListStudyFavoritesRepositoryResult = {
      items: [
        {
          profileId: "profile-1",
          questionId: "question-1",
          createdAt: new Date(
            "2026-09-19T12:00:00.000Z",
          ),
        },
      ],
      total: 1,
    };

  public async setFavorite(): Promise<StudyFavoriteRecord | null> {
    return null;
  }

  public async listFavorites(
    input: ListStudyFavoritesRepositoryInput,
  ): Promise<ListStudyFavoritesRepositoryResult> {
    this.lastListInput = input;
    return this.result;
  }
}

describe("ListStudyFavoritesUseCase", () => {
  it("lists favorites with bounded default pagination", async () => {
    const repository =
      new FakeStudyFavoriteRepository();
    const useCase =
      new ListStudyFavoritesUseCase(repository);

    const result = await useCase.execute({
      profileId: "  profile-1  ",
    });

    expect(repository.lastListInput).toEqual({
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
      new FakeStudyFavoriteRepository();
    const useCase =
      new ListStudyFavoritesUseCase(repository);

    await useCase.execute({
      profileId: "profile-1",
      page: 3,
      pageSize: 10,
    });

    expect(repository.lastListInput).toEqual({
      profileId: "profile-1",
      offset: 20,
      limit: 10,
    });
  });

  it("rejects invalid pagination", async () => {
    const repository =
      new FakeStudyFavoriteRepository();
    const useCase =
      new ListStudyFavoritesUseCase(repository);

    await expect(
      useCase.execute({
        profileId: "profile-1",
        pageSize: 0,
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
