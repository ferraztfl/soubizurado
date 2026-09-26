type RawSearchParamValue =
  | string
  | readonly string[]
  | undefined;

export type ReviewQueueRawSearchParams =
  Readonly<Record<string, RawSearchParamValue>>;

export const REVIEW_QUEUE_PAGE_SIZE = 25;

export type ReviewTopicFilter = "missing" | "assigned" | "all";
export type ReviewMediaFilter = "with" | "without" | "all";
export type ReviewSuggestionFilter = "with" | "all";

export type ReviewQueueQuery = Readonly<{
  page: number;
  pageSize: typeof REVIEW_QUEUE_PAGE_SIZE;
  search?: string;
  disciplineId?: string;
  topic: ReviewTopicFilter;
  media: ReviewMediaFilter;
  suggestion: ReviewSuggestionFilter;
}>;

export type ReviewQueueHrefInput = Readonly<{
  page?: number;
  search?: string;
  disciplineId?: string;
  topic?: ReviewTopicFilter;
  media?: ReviewMediaFilter;
  suggestion?: ReviewSuggestionFilter;
}>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_SEARCH_LENGTH = 200;

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
  const normalized = firstValue(value)?.trim();

  return normalized ? normalized : undefined;
}

function parsePage(value: RawSearchParamValue): number {
  const normalized = normalizeText(value);

  if (!normalized || !/^[0-9]+$/.test(normalized)) {
    return 1;
  }

  const parsed = Number(normalized);

  return Number.isSafeInteger(parsed) && parsed > 0
    ? parsed
    : 1;
}

function parseOption<T extends string>(
  value: RawSearchParamValue,
  allowed: readonly T[],
  fallback: T,
): T {
  const normalized = normalizeText(value);

  return allowed.find((option) => option === normalized) ?? fallback;
}

export function parseReviewQueueSearchParams(
  params: ReviewQueueRawSearchParams,
): ReviewQueueQuery {
  const search = normalizeText(params.q)?.slice(0, MAX_SEARCH_LENGTH);
  const discipline = normalizeText(params.discipline);

  return {
    page: parsePage(params.page),
    pageSize: REVIEW_QUEUE_PAGE_SIZE,
    ...(search ? { search } : {}),
    // Invalid ids would make Prisma throw on the uuid column.
    ...(discipline && UUID_PATTERN.test(discipline)
      ? { disciplineId: discipline.toLowerCase() }
      : {}),
    topic: parseOption(params.topic, ["missing", "assigned", "all"], "missing"),
    media: parseOption(params.media, ["with", "without", "all"], "all"),
    suggestion: parseOption(params.suggestion, ["with", "all"], "all"),
  };
}

export function buildReviewQueueHref(
  input: ReviewQueueHrefInput,
): string {
  const params = new URLSearchParams();

  if (input.search) {
    params.set("q", input.search);
  }

  if (input.disciplineId) {
    params.set("discipline", input.disciplineId);
  }

  if (input.topic && input.topic !== "missing") {
    params.set("topic", input.topic);
  }

  if (input.media && input.media !== "all") {
    params.set("media", input.media);
  }

  if (input.suggestion === "with") {
    params.set("suggestion", "with");
  }

  if (input.page && input.page > 1) {
    params.set("page", String(input.page));
  }

  const query = params.toString();

  return query
    ? `/admin/questoes/revisao?${query}`
    : "/admin/questoes/revisao";
}
