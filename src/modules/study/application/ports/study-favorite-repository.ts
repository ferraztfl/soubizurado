export type StudyFavoriteRecord = Readonly<{
  profileId: string;
  questionId: string;
  createdAt: Date;
}>;

export type SetStudyFavoriteRepositoryInput =
  Readonly<{
    profileId: string;
    questionId: string;
    favorite: boolean;
  }>;

export type ListStudyFavoritesRepositoryInput =
  Readonly<{
    profileId: string;
    offset: number;
    limit: number;
  }>;

export type ListStudyFavoritesRepositoryResult =
  Readonly<{
    items: readonly StudyFavoriteRecord[];
    total: number;
  }>;

export interface StudyFavoriteRepository {
  setFavorite(
    input: SetStudyFavoriteRepositoryInput,
  ): Promise<StudyFavoriteRecord | null>;

  listFavorites(
    input: ListStudyFavoritesRepositoryInput,
  ): Promise<ListStudyFavoritesRepositoryResult>;
}
