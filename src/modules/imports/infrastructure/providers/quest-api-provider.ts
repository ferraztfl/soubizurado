import { z } from "zod";

import type {
  ProviderExaminationMetadata,
  ProviderQuestionCandidate,
  QuestionProvider,
  QuestionProviderListInput,
  QuestionProviderListResult,
} from "../../application/ports/question-provider";

const alternativeSchema = z.object({
  letra: z.union([
    z.string(),
    z.number(),
  ]),
  texto: z.string().default(""),
  imagens: z
    .array(z.unknown())
    .default([]),
});

const questionSchema = z.object({
  id: z.union([
    z.string(),
    z.number(),
  ]),
  numero: z
    .union([
      z.string(),
      z.number(),
    ])
    .nullable()
    .optional(),
  enunciado: z.string(),
  alternativas: z
    .array(alternativeSchema)
    .default([]),
  gabarito: z
    .union([
      z.string(),
      z.number(),
    ])
    .nullable()
    .optional(),
  provas: z
    .array(
      z.union([
        z.string(),
        z.number(),
      ]),
    )
    .default([]),
  classificacao: z
    .object({
      materia: z
        .string()
        .nullable()
        .optional(),
      assunto: z
        .string()
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
  textos_associados: z
    .array(z.string())
    .default([]),
  anexos: z
    .array(z.unknown())
    .default([]),
  sinalizadores: z
    .object({
      tem_imagem: z
        .boolean()
        .optional(),
      tem_gabarito: z
        .boolean()
        .optional(),
      tem_texto_associado: z
        .boolean()
        .optional(),
    })
    .default({}),
});

const examinationSchema = z.object({
  id: z.union([
    z.string(),
    z.number(),
  ]),
  orgao: z
    .string()
    .nullable()
    .optional(),
  cargo: z
    .string()
    .nullable()
    .optional(),
  ano: z
    .union([
      z.string(),
      z.number(),
    ])
    .nullable()
    .optional(),
  banca: z
    .string()
    .nullable()
    .optional(),
  alternative_type: z
    .enum([
      "MULTIPLA_ESCOLHA",
      "CERTO_ERRADO",
    ])
    .nullable()
    .optional(),
  total_questoes: z
    .number()
    .int()
    .nonnegative()
    .optional(),
});

const examinationListResponseSchema = z.object({
  data: z.object({
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    per_page: z.number().int().positive(),
    items: z.array(examinationSchema),
  }),
  meta: z
    .object({
      correlationId: z
        .string()
        .nullable()
        .optional(),
      timestamp: z.string().optional(),
    })
    .optional(),
});

const quotaResponseSchema = z.object({
  data: z.object({
    planCode: z.string().nullable(),
    periodStart: z.string().nullable(),
    periodEnd: z.string().nullable(),
    used: z.number().nonnegative(),
    quotaPerCycle: z
      .number()
      .nonnegative()
      .nullable(),
    remaining: z.number().nonnegative(),
    percentUsed: z
      .number()
      .nonnegative()
      .nullable(),
    unlimited: z.boolean(),
  }),
  meta: z
    .object({
      correlationId: z
        .string()
        .nullable()
        .optional(),
      timestamp: z.string().optional(),
    })
    .optional(),
});

const errorResponseSchema = z.object({
  statusCode: z.number().optional(),
  message: z
    .union([
      z.string(),
      z.array(z.string()),
    ])
    .optional(),
  error: z.string().optional(),
  path: z.string().optional(),
  timestamp: z.string().optional(),
  correlationId: z.string().optional(),
});

const directQuestionResponseSchema = z.object({
  data: questionSchema,
  meta: z
    .object({
      correlationId: z
        .string()
        .nullable()
        .optional(),
      timestamp: z
        .string()
        .optional(),
    })
    .optional(),
});

const responseSchema = z.object({
  data: z.object({
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    per_page: z.number().int().positive(),
    next_cursor: z
      .union([
        z.string(),
        z.number(),
      ])
      .nullable()
      .optional(),
    items: z.array(questionSchema),
  }),
  meta: z
    .object({
      correlationId: z
        .string()
        .nullable()
        .optional(),
      timestamp: z
        .string()
        .optional(),
    })
    .optional(),
});

type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type Sleep = (
  milliseconds: number,
) => Promise<void>;

export type QuestApiExaminationSummary = Readonly<{
  externalId: string;
  organization: string | null;
  careerPosition: string | null;
  year: number | null;
  board: string | null;
  alternativeType:
    | "MULTIPLA_ESCOLHA"
    | "CERTO_ERRADO"
    | null;
  totalQuestions: number;
}>;

export type QuestApiExaminationListResult = Readonly<{
  total: number;
  correlationId: string | null;
  items: readonly QuestApiExaminationSummary[];
}>;

export type QuestApiQuota = Readonly<{
  planCode: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  used: number;
  quotaPerCycle: number | null;
  remaining: number;
  percentUsed: number | null;
  unlimited: boolean;
  correlationId: string | null;
}>;

export type QuestApiProviderOptions =
  Readonly<{
    apiKey: string;
    baseUrl?: string;
    fetcher?: Fetcher;
    sleep?: Sleep;
    maxAttempts?: number;
  }>;

function stringifyProviderId(
  value: string | number,
): string {
  return String(value).trim();
}

function collectUrls(
  value: unknown,
): string[] {
  if (typeof value === "string") {
    const normalized = value.trim();

    return /^https?:\/\//i.test(normalized)
      ? [normalized]
      : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectUrls);
  }

  if (
    value !== null &&
    typeof value === "object"
  ) {
    const record = value as Record<
      string,
      unknown
    >;

    const preferredKeys = [
      "url",
      "src",
      "href",
      "image",
      "imagem",
    ];

    const preferred = preferredKeys.flatMap(
      (key) => collectUrls(record[key]),
    );

    if (preferred.length > 0) {
      return preferred;
    }

    return Object.values(record).flatMap(
      collectUrls,
    );
  }

  return [];
}

function uniqueUrls(
  values: readonly string[],
): readonly string[] {
  return [...new Set(values)];
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim();

  return normalized
    ? normalized
    : null;
}

function mapQuestion(
  raw: z.infer<typeof questionSchema>,
): ProviderQuestionCandidate {
  const alternatives = raw.alternativas.map(
    (alternative) => ({
      label: stringifyProviderId(
        alternative.letra,
      ),
      contentHtml: alternative.texto,
      imageUrls: uniqueUrls(
        collectUrls(alternative.imagens),
      ),
    }),
  );

  const attachmentUrls = uniqueUrls(
    collectUrls(raw.anexos),
  );
  const alternativeImageUrls =
    alternatives.flatMap(
      (alternative) =>
        alternative.imageUrls,
    );

  return {
    externalId: stringifyProviderId(raw.id),
    number:
      raw.numero === null ||
      raw.numero === undefined
        ? null
        : stringifyProviderId(raw.numero),
    statementHtml: raw.enunciado,
    alternatives,
    answerKey:
      raw.gabarito === null ||
      raw.gabarito === undefined
        ? null
        : stringifyProviderId(
            raw.gabarito,
          ),
    examinationExternalIds:
      raw.provas.map(stringifyProviderId),
    discipline: normalizeOptionalText(
      raw.classificacao?.materia,
    ),
    topic: normalizeOptionalText(
      raw.classificacao?.assunto,
    ),
    supportTextsHtml:
      raw.textos_associados,
    attachmentUrls,
    hasImages:
      raw.sinalizadores.tem_imagem ??
      (
        attachmentUrls.length > 0 ||
        alternativeImageUrls.length > 0
      ),
    hasAnswerKey:
      raw.sinalizadores.tem_gabarito ??
      (
        raw.gabarito !== null &&
        raw.gabarito !== undefined
      ),
    hasSupportText:
      raw.sinalizadores
        .tem_texto_associado ??
      raw.textos_associados.length > 0,
    rawPayload: raw,
  };
}

function defaultSleep(
  milliseconds: number,
): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function isRetryableStatus(
  status: number,
): boolean {
  return (
    status === 429 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

function retryDelayMs(
  response: Response,
  attempt: number,
): number {
  if (response.status === 429) {
    const retryAfter = Number.parseInt(
      response.headers.get("retry-after") ?? "",
      10,
    );

    if (
      Number.isSafeInteger(retryAfter) &&
      retryAfter > 0
    ) {
      return Math.min(
        retryAfter * 1000,
        30_000,
      );
    }
  }

  return Math.min(
    500 * 2 ** (attempt - 1),
    4_000,
  );
}

async function buildRequestError(
  response: Response,
): Promise<Error> {
  const body = await response.text();

  if (body) {
    try {
      const parsed = errorResponseSchema.safeParse(
        JSON.parse(body),
      );

      if (parsed.success) {
        const messageValue =
          parsed.data.message;
        const message = Array.isArray(
          messageValue,
        )
          ? messageValue.join("; ")
          : messageValue;

        const suffix = [
          message,
          parsed.data.correlationId
            ? `correlationId=${parsed.data.correlationId}`
            : null,
        ]
          .filter(
            (value): value is string =>
              Boolean(value),
          )
          .join(" | ");

        return new Error(
          `Quest API request failed with status ${response.status}${suffix ? `: ${suffix}` : "."}`,
        );
      }
    } catch {
      // Fall through to the generic provider error.
    }
  }

  return new Error(
    `Quest API request failed with status ${response.status}.`,
  );
}

export class QuestApiProvider
  implements QuestionProvider
{
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetcher: Fetcher;
  private readonly sleep: Sleep;
  private readonly maxAttempts: number;

  public constructor(
    options: QuestApiProviderOptions,
  ) {
    const apiKey = options.apiKey.trim();

    if (!apiKey) {
      throw new Error(
        "Quest API key is required.",
      );
    }

    this.apiKey = apiKey;
    this.baseUrl = (
      options.baseUrl ??
      "https://api.quest.api.br"
    ).replace(/\/$/, "");
    this.fetcher =
      options.fetcher ?? fetch;
    this.sleep =
      options.sleep ?? defaultSleep;
    this.maxAttempts =
      options.maxAttempts ?? 3;

    if (
      !Number.isSafeInteger(this.maxAttempts) ||
      this.maxAttempts < 1 ||
      this.maxAttempts > 5
    ) {
      throw new Error(
        "Quest API maxAttempts must be between 1 and 5.",
      );
    }
  }

  private async request(
    url: URL,
  ): Promise<Response> {
    let lastError: unknown;

    for (
      let attempt = 1;
      attempt <= this.maxAttempts;
      attempt += 1
    ) {
      try {
        const response =
          await this.fetcher(
            url,
            {
              method: "GET",
              headers: {
                Accept:
                  "application/json",
                "X-API-Key":
                  this.apiKey,
              },
            },
          );

        if (response.ok) {
          return response;
        }

        if (
          isRetryableStatus(
            response.status,
          ) &&
          attempt < this.maxAttempts
        ) {
          await this.sleep(
            retryDelayMs(
              response,
              attempt,
            ),
          );

          continue;
        }

        throw await buildRequestError(
          response,
        );
      } catch (error) {
        lastError = error;

        if (
          error instanceof Error &&
          error.message.startsWith(
            "Quest API request failed with status",
          )
        ) {
          throw error;
        }

        if (
          attempt < this.maxAttempts
        ) {
          await this.sleep(
            Math.min(
              500 *
                2 ** (attempt - 1),
              4_000,
            ),
          );

          continue;
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(
          "Quest API request failed after retries.",
        );
  }

  public async getQuota(): Promise<QuestApiQuota> {
    const url = new URL(
      "/v2/quota",
      this.baseUrl,
    );

    const response =
      await this.request(url);

    const parsed =
      quotaResponseSchema.safeParse(
        await response.json(),
      );

    if (!parsed.success) {
      throw new Error(
        "Quest API returned an unexpected quota response shape.",
      );
    }

    return {
      ...parsed.data.data,
      correlationId:
        parsed.data.meta
          ?.correlationId ?? null,
    };
  }

  public async listExaminations(
    input: Readonly<{
      limit: number;
      page?: number;
      board?: string;
      year?: string;
      organization?: string;
      careerPosition?: string;
      alternativeType?:
        | "MULTIPLA_ESCOLHA"
        | "CERTO_ERRADO";
    }>,
  ): Promise<QuestApiExaminationListResult> {
    if (
      !Number.isSafeInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > 100
    ) {
      throw new Error(
        "Quest API exam limit must be between 1 and 100.",
      );
    }

    const page = input.page ?? 1;

    if (
      !Number.isSafeInteger(page) ||
      page < 1
    ) {
      throw new Error(
        "Quest API exam page must be a positive integer.",
      );
    }

    const url = new URL(
      "/v1/provas",
      this.baseUrl,
    );

    url.searchParams.set(
      "page",
      String(page),
    );
    url.searchParams.set(
      "per_page",
      String(input.limit),
    );

    if (input.board) {
      url.searchParams.set(
        "banca",
        input.board,
      );
    }

    if (input.year) {
      url.searchParams.set(
        "ano",
        input.year,
      );
    }

    if (input.organization) {
      url.searchParams.set(
        "orgao",
        input.organization,
      );
    }

    if (input.careerPosition) {
      url.searchParams.set(
        "cargo",
        input.careerPosition,
      );
    }

    if (input.alternativeType) {
      url.searchParams.set(
        "alternative_type",
        input.alternativeType,
      );
    }

    const response =
      await this.request(url);

    const parsed =
      examinationListResponseSchema.safeParse(
        await response.json(),
      );

    if (!parsed.success) {
      throw new Error(
        "Quest API returned an unexpected examination list response shape.",
      );
    }

    return {
      total: parsed.data.data.total,
      correlationId:
        parsed.data.meta
          ?.correlationId ?? null,
      items:
        parsed.data.data.items.map(
          (item) => {
            const parsedYear =
              item.ano === null ||
              item.ano === undefined
                ? null
                : Number.parseInt(
                    String(item.ano),
                    10,
                  );

            return {
              externalId:
                stringifyProviderId(
                  item.id,
                ),
              organization:
                normalizeOptionalText(
                  item.orgao,
                ),
              careerPosition:
                normalizeOptionalText(
                  item.cargo,
                ),
              year:
                Number.isSafeInteger(
                  parsedYear,
                )
                  ? parsedYear
                  : null,
              board:
                normalizeOptionalText(
                  item.banca,
                ),
              alternativeType:
                item.alternative_type ??
                null,
              totalQuestions:
                item.total_questoes ??
                0,
            };
          },
        ),
    };
  }

  public async getExamination(
    externalId: string,
  ): Promise<ProviderExaminationMetadata | null> {
    const normalizedId = externalId.trim();

    if (!normalizedId) {
      throw new Error(
        "Quest API examination id is required.",
      );
    }

    const url = new URL(
      "/v1/provas",
      this.baseUrl,
    );

    url.searchParams.set(
      "codigo",
      normalizedId,
    );
    url.searchParams.set(
      "per_page",
      "10",
    );

    const response =
      await this.request(url);

    const parsed =
      examinationListResponseSchema.safeParse(
        await response.json(),
      );

    if (!parsed.success) {
      throw new Error(
        "Quest API returned an unexpected examination response shape.",
      );
    }

    const match =
      parsed.data.data.items.find(
        (item) =>
          stringifyProviderId(item.id) ===
          normalizedId,
      );

    if (!match) {
      return null;
    }

    const parsedYear =
      match.ano === null ||
      match.ano === undefined
        ? null
        : Number.parseInt(
            String(match.ano),
            10,
          );

    return {
      externalId: normalizedId,
      organization: normalizeOptionalText(
        match.orgao,
      ),
      careerPosition:
        normalizeOptionalText(
          match.cargo,
        ),
      year: Number.isSafeInteger(parsedYear)
        ? parsedYear
        : null,
      board: normalizeOptionalText(
        match.banca,
      ),
      alternativeType:
        match.alternative_type ?? null,
    };
  }

  public async listQuestions(
    input: QuestionProviderListInput,
  ): Promise<QuestionProviderListResult> {
    if (
      !Number.isSafeInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > 100
    ) {
      throw new Error(
        "Quest API limit must be between 1 and 100.",
      );
    }

    if (input.externalId) {
      const normalizedId =
        input.externalId.trim();

      if (!normalizedId) {
        throw new Error(
          "Quest API question id is required.",
        );
      }

      const directUrl = new URL(
        `/v2/questoes/${encodeURIComponent(
          normalizedId,
        )}`,
        this.baseUrl,
      );

      if (input.includeAnswerKey) {
        directUrl.searchParams.set(
          "include_gabarito",
          "true",
        );
      }

      const directResponse =
        await this.request(directUrl);

      const directParsed =
        directQuestionResponseSchema.safeParse(
          await directResponse.json(),
        );

      if (!directParsed.success) {
        throw new Error(
          "Quest API returned an unexpected direct question response shape.",
        );
      }

      return {
        total: 1,
        nextCursor: null,
        correlationId:
          directParsed.data.meta
            ?.correlationId ?? null,
        items: [
          mapQuestion(
            directParsed.data.data,
          ),
        ],
      };
    }

    const url = new URL(
      "/v2/questoes",
      this.baseUrl,
    );

    url.searchParams.set(
      "per_page",
      String(input.limit),
    );

    if (input.afterId) {
      url.searchParams.set(
        "after_id",
        input.afterId,
      );
    }

    if (input.includeAnswerKey) {
      url.searchParams.set(
        "include_gabarito",
        "true",
      );
    }

    if (input.requireAnswerKey) {
      url.searchParams.set(
        "tem_gabarito",
        "true",
      );
    }

    const filters = input.filters;

    if (filters?.board) {
      url.searchParams.set(
        "banca",
        filters.board,
      );
    }

    if (filters?.year) {
      url.searchParams.set(
        "ano",
        filters.year,
      );
    }

    if (filters?.discipline) {
      url.searchParams.set(
        "materia",
        filters.discipline,
      );
    }

    if (filters?.topic) {
      url.searchParams.set(
        "assunto",
        filters.topic,
      );
    }

    if (
      filters?.hasAttachments !== undefined
    ) {
      url.searchParams.set(
        "tem_anexos",
        String(filters.hasAttachments),
      );
    }

    const response =
      await this.request(url);

    const parsed = responseSchema.safeParse(
      await response.json(),
    );

    if (!parsed.success) {
      throw new Error(
        "Quest API returned an unexpected response shape.",
      );
    }

    return {
      total: parsed.data.data.total,
      nextCursor:
        parsed.data.data.next_cursor ===
          null ||
        parsed.data.data.next_cursor ===
          undefined
          ? null
          : stringifyProviderId(
              parsed.data.data.next_cursor,
            ),
      correlationId:
        parsed.data.meta
          ?.correlationId ?? null,
      items:
        parsed.data.data.items.map(
          mapQuestion,
        ),
    };
  }
}
