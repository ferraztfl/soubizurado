import {
  ApplicationError,
} from "../../../../shared/errors/application-error";
import {
  ERROR_CODES,
} from "../../../../shared/errors/error-code";
import type {
  StudyFavoriteRepository,
} from "../ports/study-favorite-repository";

export type SetStudyQuestionFavoriteInput = Readonly<{
  profileId: string;
  questionId: string;
  favorite: boolean;
}>;

export type SetStudyQuestionFavoriteOutput = Readonly<{
  questionId: string;
  favorite: boolean;
  createdAt: Date | null;
}>;

function requireText(
  value: string,
  field: string,
): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new ApplicationError(
      ERROR_CODES.VALIDATION_ERROR,
      `${field} is required.`,
    );
  }

  return normalized;
}

export class SetStudyQuestionFavoriteUseCase {
  public constructor(
    private readonly studyFavoriteRepository:
      StudyFavoriteRepository,
  ) {}

  public async execute(
    input: SetStudyQuestionFavoriteInput,
  ): Promise<SetStudyQuestionFavoriteOutput> {
    const profileId = requireText(
      input.profileId,
      "profileId",
    );
    const questionId = requireText(
      input.questionId,
      "questionId",
    );

    if (typeof input.favorite !== "boolean") {
      throw new ApplicationError(
        ERROR_CODES.VALIDATION_ERROR,
        "favorite must be a boolean.",
      );
    }

    const record =
      await this.studyFavoriteRepository.setFavorite({
        profileId,
        questionId,
        favorite: input.favorite,
      });

    if (input.favorite && !record) {
      throw new ApplicationError(
        ERROR_CODES.INTERNAL_ERROR,
        "Favorite repository returned an inconsistent result.",
      );
    }

    return {
      questionId,
      favorite: input.favorite,
      createdAt: record?.createdAt ?? null,
    };
  }
}
