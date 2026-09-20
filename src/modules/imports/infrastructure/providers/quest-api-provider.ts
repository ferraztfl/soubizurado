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

export type QuestApiProviderOptions =
  Readonly<{
    apiKey: string;
    baseUrl?: string;
    fetcher?: Fetcher;
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

export class QuestApiProvider
  implements QuestionProvider
{
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetcher: Fetcher;

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

    const response = await this.fetcher(
      url,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-API-Key": this.apiKey,
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `Quest API request failed with status ${response.status}.`,
      );
    }

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

    if (filters?.alternativeType) {
      url.searchParams.set(
        "alternative_type",
        filters.alternativeType,
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

    const response = await this.fetcher(
      url,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-API-Key": this.apiKey,
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `Quest API request failed with status ${response.status}.`,
      );
    }

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
