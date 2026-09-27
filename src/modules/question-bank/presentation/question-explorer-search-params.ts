import {
  QUESTION_TYPES,
  type QuestionType,
} from "../domain/question-type";

type RawSearchParamValue =
  | string
  | readonly string[]
  | undefined;

export type QuestionExplorerRawSearchParams =
  Readonly<Record<string, RawSearchParamValue>>;

export const QUESTION_EXPLORER_PAGE_SIZES = [10, 20, 50] as const;
export type QuestionExplorerPageSize = (typeof QUESTION_EXPLORER_PAGE_SIZES)[number];

/** URL value → repository sort. */
export const QUESTION_EXPLORER_SORTS = {
  recentes: "recent",
  antigas: "oldest",
  ano: "year",
} as const;
export type QuestionExplorerSortParam = keyof typeof QUESTION_EXPLORER_SORTS;

const DEFAULT_PAGE_SIZE: QuestionExplorerPageSize = 10;
const DEFAULT_SORT: QuestionExplorerSortParam = "recentes";

export type QuestionExplorerQuery = Readonly<{
  page: number;
  pageSize: QuestionExplorerPageSize;
  sort: QuestionExplorerSortParam;
  filters: Readonly<{
    search?: string;
    disciplineId?: string;
    boardId?: string;
    year?: number;
    type?: QuestionType;
  }>;
}>;

export type QuestionExplorerHrefInput = Readonly<{
  page?: number;
  pageSize?: QuestionExplorerPageSize;
  sort?: QuestionExplorerSortParam;
  search?: string;
  disciplineId?: string;
  boardId?: string;
  year?: number;
  type?: QuestionType;
}>;

function firstValue(
  value: RawSearchParamValue,
): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  return value?.[0];
}

function normalizeText(
  value: RawSearchParamValue,
): string | undefined {
  const first = firstValue(value);

  if (first === undefined) {
    return undefined;
  }

  const normalized = first.trim();

  return normalized.length > 0
    ? normalized
    : undefined;
}

function parsePositiveInteger(
  value: RawSearchParamValue,
): number | undefined {
  const normalized = normalizeText(value);

  if (
    normalized === undefined ||
    !/^[0-9]+$/.test(normalized)
  ) {
    return undefined;
  }

  const parsed = Number(normalized);

  return Number.isSafeInteger(parsed) &&
    parsed > 0
    ? parsed
    : undefined;
}

function parseYear(
  value: RawSearchParamValue,
): number | undefined {
  const parsed = parsePositiveInteger(value);

  return parsed !== undefined &&
    parsed >= 1900 &&
    parsed <= 2100
    ? parsed
    : undefined;
}

function parseQuestionType(
  value: RawSearchParamValue,
): QuestionType | undefined {
  const normalized = normalizeText(value);

  if (
    normalized === QUESTION_TYPES.MULTIPLE_CHOICE ||
    normalized === QUESTION_TYPES.TRUE_FALSE
  ) {
    return normalized;
  }

  return undefined;
}

export function parseQuestionExplorerSearchParams(
  params: QuestionExplorerRawSearchParams,
): QuestionExplorerQuery {
  const search = normalizeText(params.q);
  const disciplineId = normalizeText(
    params.discipline,
  );
  const boardId = normalizeText(params.board);
  const year = parseYear(params.year);
  const type = parseQuestionType(params.type);
  const page =
    parsePositiveInteger(params.page) ?? 1;

  const pageSizeValue = parsePositiveInteger(params.por);
  const pageSize =
    QUESTION_EXPLORER_PAGE_SIZES.find((size) => size === pageSizeValue) ?? DEFAULT_PAGE_SIZE;
  const sortValue = normalizeText(params.ordem);
  const sort =
    sortValue && sortValue in QUESTION_EXPLORER_SORTS ? (sortValue as QuestionExplorerSortParam) : DEFAULT_SORT;

  return {
    page,
    pageSize,
    sort,
    filters: {
      ...(search ? { search } : {}),
      ...(disciplineId
        ? { disciplineId }
        : {}),
      ...(boardId ? { boardId } : {}),
      ...(year !== undefined ? { year } : {}),
      ...(type !== undefined ? { type } : {}),
    },
  };
}

export function buildQuestionExplorerHref(
  input: QuestionExplorerHrefInput,
): string {
  const params = new URLSearchParams();

  if (input.search) {
    params.set("q", input.search);
  }

  if (input.disciplineId) {
    params.set(
      "discipline",
      input.disciplineId,
    );
  }

  if (input.boardId) {
    params.set("board", input.boardId);
  }

  if (input.year !== undefined) {
    params.set("year", String(input.year));
  }

  if (input.type !== undefined) {
    params.set("type", input.type);
  }

  if (input.pageSize !== undefined && input.pageSize !== DEFAULT_PAGE_SIZE) {
    params.set("por", String(input.pageSize));
  }

  if (input.sort !== undefined && input.sort !== DEFAULT_SORT) {
    params.set("ordem", input.sort);
  }

  if (
    input.page !== undefined &&
    input.page > 1
  ) {
    params.set("page", String(input.page));
  }

  const query = params.toString();

  return query.length > 0
    ? `/app/questoes?${query}`
    : "/app/questoes";
}
