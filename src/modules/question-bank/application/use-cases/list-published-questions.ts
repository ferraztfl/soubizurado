import {
  ApplicationError,
} from "../../../../shared/errors/application-error";

import {
  ERROR_CODES,
} from "../../../../shared/errors/error-code";

import {
  QUESTION_TYPES,
  type QuestionType,
} from "../../domain/question-type";

import type {
  PublicQuestionDto,
} from "../dto/public-question";

import {
  toPublicQuestionDto,
} from "../mappers/to-public-question-dto";

import type {
  PublicQuestionReadFilters,
  PublicQuestionReadRepository,
} from "../ports/public-question-read-repository";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_SEARCH_LENGTH = 120;

export type ListPublishedQuestionsQuery = Readonly<{
  page?: number;
  pageSize?: number;
  filters?: PublicQuestionReadFilters;
}>;

export type ListPublishedQuestionsOutput = Readonly<{
  items: readonly PublicQuestionDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}>;

function requirePositiveSafeInteger(
  value: number,
  field: string,
): void {
  if (
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    throw new ApplicationError(
      ERROR_CODES.VALIDATION_ERROR,
      `${field} must be a positive integer.`,
    );
  }
}

function normalizeOptionalText(
  value: string | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();

  return normalized.length > 0
    ? normalized
    : undefined;
}

function requireValidQuestionType(
  value: QuestionType | undefined,
): void {
  if (
    value !== undefined &&
    value !== QUESTION_TYPES.MULTIPLE_CHOICE &&
    value !== QUESTION_TYPES.TRUE_FALSE
  ) {
    throw new ApplicationError(
      ERROR_CODES.VALIDATION_ERROR,
      "Question type is invalid.",
    );
  }
}

function normalizeFilters(
  filters: PublicQuestionReadFilters,
): PublicQuestionReadFilters {
  const search = normalizeOptionalText(
    filters.search,
  );

  if (
    search !== undefined &&
    search.length > MAX_SEARCH_LENGTH
  ) {
    throw new ApplicationError(
      ERROR_CODES.VALIDATION_ERROR,
      `Search cannot exceed ${MAX_SEARCH_LENGTH} characters.`,
    );
  }

  if (
    filters.year !== undefined &&
    (
      !Number.isSafeInteger(filters.year) ||
      filters.year < 1900 ||
      filters.year > 2100
    )
  ) {
    throw new ApplicationError(
      ERROR_CODES.VALIDATION_ERROR,
      "Year is invalid.",
    );
  }

  requireValidQuestionType(filters.type);

  return {
    ...(search ? { search } : {}),
    ...(normalizeOptionalText(
      filters.disciplineId,
    )
      ? {
          disciplineId: normalizeOptionalText(
            filters.disciplineId,
          ),
        }
      : {}),
    ...(normalizeOptionalText(filters.areaId)
      ? {
          areaId: normalizeOptionalText(
            filters.areaId,
          ),
        }
      : {}),
    ...(normalizeOptionalText(filters.topicId)
      ? {
          topicId: normalizeOptionalText(
            filters.topicId,
          ),
        }
      : {}),
    ...(normalizeOptionalText(
      filters.subtopicId,
    )
      ? {
          subtopicId: normalizeOptionalText(
            filters.subtopicId,
          ),
        }
      : {}),
    ...(normalizeOptionalText(filters.boardId)
      ? {
          boardId: normalizeOptionalText(
            filters.boardId,
          ),
        }
      : {}),
    ...(normalizeOptionalText(
      filters.examinationId,
    )
      ? {
          examinationId: normalizeOptionalText(
            filters.examinationId,
          ),
        }
      : {}),
    ...(filters.year !== undefined
      ? { year: filters.year }
      : {}),
    ...(filters.type !== undefined
      ? { type: filters.type }
      : {}),
  };
}

export class ListPublishedQuestionsUseCase {
  public constructor(
    private readonly questionRepository: Pick<
      PublicQuestionReadRepository,
      "listPublished"
    >,
  ) {}

  public async execute(
    query: ListPublishedQuestionsQuery = {},
  ): Promise<ListPublishedQuestionsOutput> {
    const page = query.page ?? DEFAULT_PAGE;
    const pageSize =
      query.pageSize ?? DEFAULT_PAGE_SIZE;

    requirePositiveSafeInteger(page, "page");
    requirePositiveSafeInteger(
      pageSize,
      "pageSize",
    );

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
      await this.questionRepository.listPublished({
        filters: normalizeFilters(
          query.filters ?? {},
        ),
        offset,
        limit: pageSize,
      });

    return {
      items: result.items.map(
        toPublicQuestionDto,
      ),
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
