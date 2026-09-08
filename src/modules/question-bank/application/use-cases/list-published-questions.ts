import {
  ApplicationError,
} from "../../../../shared/errors/application-error";

import {
  ERROR_CODES,
} from "../../../../shared/errors/error-code";

import type {
  PublicQuestionDto,
} from "../dto/public-question";

import {
  toPublicQuestionDto,
} from "../mappers/to-public-question-dto";

import type {
  PublishedQuestionFilters,
  QuestionRepository,
} from "../ports/question-repository";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export type ListPublishedQuestionsQuery = Readonly<{
  page?: number;
  pageSize?: number;
  filters?: PublishedQuestionFilters;
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

export class ListPublishedQuestionsUseCase {
  public constructor(
    private readonly questionRepository: QuestionRepository,
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
        filters: query.filters ?? {},
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
