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

export type QuestionExplorerQuery = Readonly<{
  page: number;
  pageSize: 12;
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

  return {
    page,
    pageSize: 12,
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
