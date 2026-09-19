import {
  ApplicationError,
} from "../../../../shared/errors/application-error";
import {
  ERROR_CODES,
} from "../../../../shared/errors/error-code";
import type {
  StudyFavoriteRecord,
  StudyFavoriteRepository,
} from "../ports/study-favorite-repository";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export type ListStudyFavoritesInput = Readonly<{
  profileId: string;
  page?: number;
  pageSize?: number;
}>;

export type ListStudyFavoritesOutput = Readonly<{
  items: readonly StudyFavoriteRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
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

function requirePositiveSafeInteger(
  value: number,
  field: string,
): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ApplicationError(
      ERROR_CODES.VALIDATION_ERROR,
      `${field} must be a positive integer.`,
    );
  }
}

export class ListStudyFavoritesUseCase {
  public constructor(
    private readonly studyFavoriteRepository:
      StudyFavoriteRepository,
  ) {}

  public async execute(
    input: ListStudyFavoritesInput,
  ): Promise<ListStudyFavoritesOutput> {
    const profileId = requireText(
      input.profileId,
      "profileId",
    );
    const page = input.page ?? DEFAULT_PAGE;
    const pageSize =
      input.pageSize ?? DEFAULT_PAGE_SIZE;

    requirePositiveSafeInteger(page, "page");
    requirePositiveSafeInteger(pageSize, "pageSize");

    if (pageSize > MAX_PAGE_SIZE) {
      throw new ApplicationError(
        ERROR_CODES.VALIDATION_ERROR,
        `pageSize cannot exceed ${MAX_PAGE_SIZE}.`,
      );
    }

    const offset = (page - 1) * pageSize;

    if (!Number.isSafeInteger(offset)) {
      throw new ApplicationError(
        ERROR_CODES.VALIDATION_ERROR,
        "Pagination offset is too large.",
      );
    }

    const result =
      await this.studyFavoriteRepository.listFavorites({
        profileId,
        offset,
        limit: pageSize,
      });

    return {
      items: result.items,
      page,
      pageSize,
      total: result.total,
      totalPages:
        result.total === 0
          ? 0
          : Math.ceil(result.total / pageSize),
    };
  }
}
