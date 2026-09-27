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

export const QUESTION_EXPLORER_PAGE_SIZES = [10, 20, 50, 100] as const;
export type QuestionExplorerPageSize = (typeof QUESTION_EXPLORER_PAGE_SIZES)[number];

/** URL value → repository sort. */
export const QUESTION_EXPLORER_SORTS = {
  recentes: "recent",
  antigas: "oldest",
  ano: "year",
} as const;
export type QuestionExplorerSortParam = keyof typeof QUESTION_EXPLORER_SORTS;

const DEFAULT_PAGE_SIZE: QuestionExplorerPageSize = 20;
const DEFAULT_SORT: QuestionExplorerSortParam = "recentes";

/**
 * Cookies that remember the student's last page size and sort, so the choice
 * survives filter changes and links that do not carry `por` / `ordem`.
 */
export const QUESTION_EXPLORER_PAGE_SIZE_COOKIE = "sb_questoes_por";
export const QUESTION_EXPLORER_SORT_COOKIE = "sb_questoes_ordem";

/** Saved preferences (raw cookie values); the URL always wins over them. */
export type QuestionExplorerPreferences = Readonly<{
  pageSize?: string;
  sort?: string;
}>;

/**
 * "Minhas questões" (URL value `situacao`) → repository filter: an answered
 * status, or "favorite" for the starred questions.
 */
export const QUESTION_EXPLORER_SITUATIONS = {
  "nao-resolvidas": "unanswered",
  erradas: "wrong",
  acertadas: "correct",
  favoritas: "favorite",
} as const;
export type QuestionExplorerSituation = keyof typeof QUESTION_EXPLORER_SITUATIONS;

export type QuestionExplorerFilters = Readonly<{
  search?: string;
  disciplineId?: string;
  /** Tópico (Area). */
  areaId?: string;
  /** Subtópico (Topic). */
  topicId?: string;
  boardId?: string;
  organizationId?: string;
  careerPositionId?: string;
  year?: number;
  type?: QuestionType;
  situation?: QuestionExplorerSituation;
}>;

export type QuestionExplorerQuery = Readonly<{
  page: number;
  pageSize: QuestionExplorerPageSize;
  sort: QuestionExplorerSortParam;
  filters: QuestionExplorerFilters;
}>;

export type QuestionExplorerHrefInput = QuestionExplorerFilters &
  Readonly<{
    page?: number;
    pageSize?: QuestionExplorerPageSize;
    sort?: QuestionExplorerSortParam;
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

function parsePageSize(value: RawSearchParamValue): QuestionExplorerPageSize | undefined {
  const parsed = parsePositiveInteger(value);

  return QUESTION_EXPLORER_PAGE_SIZES.find((size) => size === parsed);
}

function parseSort(value: RawSearchParamValue): QuestionExplorerSortParam | undefined {
  const normalized = normalizeText(value);

  return normalized && Object.hasOwn(QUESTION_EXPLORER_SORTS, normalized)
    ? (normalized as QuestionExplorerSortParam)
    : undefined;
}

export function parseQuestionExplorerSearchParams(
  params: QuestionExplorerRawSearchParams,
  preferences: QuestionExplorerPreferences = {},
): QuestionExplorerQuery {
  const search = normalizeText(params.q);
  const disciplineId = normalizeText(
    params.discipline,
  );
  const areaId = normalizeText(params.area);
  const topicId = normalizeText(params.topic);
  const boardId = normalizeText(params.board);
  const organizationId = normalizeText(params.org);
  const careerPositionId = normalizeText(params.cargo);
  const year = parseYear(params.year);
  const type = parseQuestionType(params.type);
  const situationValue = normalizeText(params.situacao);
  const situation =
    situationValue && Object.hasOwn(QUESTION_EXPLORER_SITUATIONS, situationValue)
      ? (situationValue as QuestionExplorerSituation)
      : undefined;
  const page =
    parsePositiveInteger(params.page) ?? 1;

  const pageSize =
    parsePageSize(params.por) ?? parsePageSize(preferences.pageSize) ?? DEFAULT_PAGE_SIZE;
  const sort = parseSort(params.ordem) ?? parseSort(preferences.sort) ?? DEFAULT_SORT;

  return {
    page,
    pageSize,
    sort,
    filters: {
      ...(search ? { search } : {}),
      ...(disciplineId
        ? { disciplineId }
        : {}),
      ...(areaId ? { areaId } : {}),
      ...(topicId ? { topicId } : {}),
      ...(boardId ? { boardId } : {}),
      ...(organizationId ? { organizationId } : {}),
      ...(careerPositionId ? { careerPositionId } : {}),
      ...(year !== undefined ? { year } : {}),
      ...(type !== undefined ? { type } : {}),
      ...(situation ? { situation } : {}),
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

  if (input.areaId) {
    params.set("area", input.areaId);
  }

  if (input.topicId) {
    params.set("topic", input.topicId);
  }

  if (input.boardId) {
    params.set("board", input.boardId);
  }

  if (input.organizationId) {
    params.set("org", input.organizationId);
  }

  if (input.careerPositionId) {
    params.set("cargo", input.careerPositionId);
  }

  if (input.year !== undefined) {
    params.set("year", String(input.year));
  }

  if (input.type !== undefined) {
    params.set("type", input.type);
  }

  if (input.situation) {
    params.set("situacao", input.situation);
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
