import { z } from "zod";

import type {
  ProviderExaminationMetadata,
  ProviderQuestionCandidate,
  QuestionProvider,
  QuestionProviderListInput,
  QuestionProviderListResult,
} from "../../application/ports/question-provider";

type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type EnemDataProviderOptions =
  Readonly<{
    baseUrl?: string;
    fetcher?: Fetcher;
    concurrency?: number;
  }>;

const disciplineSchema = z.object({
  label: z.string(),
  value: z.string(),
});

const questionReferenceSchema = z.object({
  title: z.string(),
  index: z.number().int().positive(),
  discipline: z.string(),
  language: z
    .string()
    .nullable()
    .optional(),
});

const examDetailsSchema = z.object({
  title: z.string(),
  year: z.number().int(),
  disciplines: z.array(disciplineSchema),
  languages: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
      }),
    )
    .default([]),
  questions: z.array(questionReferenceSchema),
});


const examIndexSchema = z.array(
  z.object({
    title: z.string(),
    year: z.number().int(),
    disciplines:
      z.array(disciplineSchema),
    languages: z
      .array(
        z.object({
          label: z.string(),
          value: z.string(),
        }),
      )
      .default([]),
  }),
);

const nullableString = z
  .string()
  .nullish()
  .transform((value) => value ?? "");

const nullableStringArray = z
  .array(z.string())
  .nullish()
  .transform((value) => value ?? []);

const alternativeSchema = z.object({
  letter: z.string(),
  text: nullableString,
  file: z
    .string()
    .nullable()
    .optional(),
  isCorrect: z.boolean(),
});

const questionDetailsSchema = z.object({
  title: z.string(),
  index: z.number().int().positive(),
  year: z.number().int(),
  language: z
    .string()
    .nullable()
    .optional(),
  discipline: z.string(),
  context: nullableString,
  files: nullableStringArray,
  correctAlternative: z
    .string()
    .nullable()
    .optional(),
  alternativesIntroduction:
    nullableString,
  alternatives: z.array(alternativeSchema),
});

type ExamDetails =
  z.infer<typeof examDetailsSchema>;
type QuestionReference =
  z.infer<typeof questionReferenceSchema>;
type QuestionDetails =
  z.infer<typeof questionDetailsSchema>;

function normalizeBaseUrl(
  value: string,
): string {
  return value.replace(/\/+$/, "");
}

function questionPath(
  reference: QuestionReference,
): string {
  const language =
    reference.language?.trim();

  return language
    ? `${reference.index}-${language}`
    : String(reference.index);
}

function externalQuestionId(
  year: number,
  reference: QuestionReference,
): string {
  return `enem-${year}-${questionPath(
    reference,
  )}`;
}

function markdownHasImage(
  value: string,
): boolean {
  return /!\[[^\]]*\]\([^)]*\)/.test(
    value,
  );
}

function uniqueStrings(
  values: readonly (
    | string
    | null
    | undefined
  )[],
): readonly string[] {
  return [
    ...new Set(
      values
        .map((value) =>
          value?.trim(),
        )
        .filter(
          (value): value is string =>
            Boolean(value),
        ),
    ),
  ];
}

function formatZodIssues(
  error: z.ZodError,
): string {
  return error.issues
    .slice(0, 8)
    .map((issue) => {
      const path =
        issue.path.length > 0
          ? issue.path.join(".")
          : "<root>";

      return `${path}: ${issue.message}`;
    })
    .join(" | ");
}

function parseYear(
  value: string | undefined,
): number {
  const normalized =
    value?.trim().replace(
      /^enem-/i,
      "",
    );

  const year = Number(normalized);

  if (
    !Number.isSafeInteger(year) ||
    year < 2009 ||
    year > 2100
  ) {
    throw new Error(
      "ENEM year must be provided between 2009 and 2100.",
    );
  }

  return year;
}

async function mapWithConcurrency<
  TInput,
  TOutput,
>(
  items: readonly TInput[],
  concurrency: number,
  mapper: (
    item: TInput,
    index: number,
  ) => Promise<TOutput>,
): Promise<TOutput[]> {
  const output =
    new Array<TOutput>(
      items.length,
    );
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;

      output[index] =
        await mapper(
          items[index]!,
          index,
        );
    }
  }

  await Promise.all(
    Array.from(
      {
        length: Math.min(
          concurrency,
          items.length,
        ),
      },
      () => worker(),
    ),
  );

  return output;
}

export class EnemDataProvider
  implements QuestionProvider
{
  private readonly baseUrl: string;
  private readonly fetcher: Fetcher;
  private readonly concurrency: number;

  public constructor(
    options: EnemDataProviderOptions = {},
  ) {
    this.baseUrl = normalizeBaseUrl(
      options.baseUrl ??
        "https://raw.githubusercontent.com/yunger7/enem-api/main/public",
    );
    this.fetcher =
      options.fetcher ?? fetch;
    this.concurrency =
      options.concurrency ?? 8;

    if (
      !Number.isSafeInteger(
        this.concurrency,
      ) ||
      this.concurrency < 1 ||
      this.concurrency > 20
    ) {
      throw new Error(
        "ENEM provider concurrency must be between 1 and 20.",
      );
    }
  }

  private async getJson(
    path: string,
  ): Promise<unknown> {
    const response =
      await this.fetcher(
        `${this.baseUrl}/${path.replace(
          /^\/+/, 
          "",
        )}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        },
      );

    if (!response.ok) {
      throw new Error(
        `ENEM dataset request failed with status ${response.status} for ${path}.`,
      );
    }

    return response.json();
  }

  public async listAvailableYears(): Promise<readonly number[]> {
    const raw =
      await this.getJson(
        "exams.json",
      );
    const parsed =
      examIndexSchema.safeParse(raw);

    if (!parsed.success) {
      throw new Error(
        `ENEM dataset returned an unexpected exam index response shape: ${formatZodIssues(
          parsed.error,
        )}`,
      );
    }

    return [
      ...new Set(
        parsed.data.map(
          (exam) => exam.year,
        ),
      ),
    ].sort(
      (first, second) =>
        first - second,
    );
  }

  private async getExamDetails(
    year: number,
  ): Promise<ExamDetails> {
    const raw =
      await this.getJson(
        `${year}/details.json`,
      );
    const parsed =
      examDetailsSchema.safeParse(raw);

    if (!parsed.success) {
      throw new Error(
        `ENEM dataset returned an unexpected exam response shape: ${formatZodIssues(
          parsed.error,
        )}`,
      );
    }

    return parsed.data;
  }

  private async getQuestionDetails(
    year: number,
    reference: QuestionReference,
  ): Promise<QuestionDetails> {
    const path =
      `${year}/questions/${questionPath(
        reference,
      )}/details.json`;

    const raw =
      await this.getJson(path);
    const parsed =
      questionDetailsSchema.safeParse(
        raw,
      );

    if (!parsed.success) {
      throw new Error(
        `ENEM dataset returned an unexpected question response shape for ${path}: ${formatZodIssues(
          parsed.error,
        )}`,
      );
    }

    return parsed.data;
  }

  public async listQuestions(
    input: QuestionProviderListInput,
  ): Promise<QuestionProviderListResult> {
    const year = parseYear(
      input.examinationId ??
        input.filters?.year,
    );
    const exam =
      await this.getExamDetails(
        year,
      );

    const disciplineLabels =
      new Map(
        exam.disciplines.map(
          (discipline) => [
            discipline.value,
            discipline.label
              .replace(/\u00a0/g, " ")
              .replace(/\s+/g, " ")
              .trim(),
          ],
        ),
      );

    const ordered =
      exam.questions.map(
        (reference) => ({
          reference,
          externalId:
            externalQuestionId(
              year,
              reference,
            ),
        }),
      );

    let startIndex = 0;

    if (input.externalId) {
      const exactIndex =
        ordered.findIndex(
          (item) =>
            item.externalId ===
            input.externalId,
        );

      if (exactIndex < 0) {
        return {
          total: ordered.length,
          nextCursor: null,
          correlationId: null,
          items: [],
        };
      }

      startIndex = exactIndex;
    } else if (input.afterId) {
      const cursorIndex =
        ordered.findIndex(
          (item) =>
            item.externalId ===
            input.afterId,
        );

      if (cursorIndex >= 0) {
        startIndex =
          cursorIndex + 1;
      }
    }

    const selected = input.externalId
      ? ordered.slice(
          startIndex,
          startIndex + 1,
        )
      : ordered.slice(
          startIndex,
          startIndex + input.limit,
        );

    const items =
      await mapWithConcurrency(
        selected,
        this.concurrency,
        async ({
          reference,
          externalId,
        }): Promise<ProviderQuestionCandidate> => {
          const raw =
            await this.getQuestionDetails(
              year,
              reference,
            );

          const alternativeImageUrls =
            raw.alternatives.flatMap(
              (alternative) =>
                alternative.file
                  ? [alternative.file]
                  : [],
            );
          const attachmentUrls =
            uniqueStrings([
              ...raw.files,
              ...alternativeImageUrls,
            ]);

          const context =
            raw.context.trim();
          const introduction =
            raw.alternativesIntroduction.trim();

          const statement =
            introduction ||
            context ||
            raw.title;

          const supportTexts =
            introduction && context
              ? [context]
              : [];

          const sourcePath =
            questionPath(reference);

          return {
            externalId,
            number:
              String(raw.index),
            statementHtml: statement,
            alternatives:
              raw.alternatives.map(
                (alternative) => ({
                  label:
                    alternative.letter,
                  contentHtml:
                    alternative.text,
                  imageUrls:
                    alternative.file
                      ? [
                          alternative.file,
                        ]
                      : [],
                }),
              ),
            answerKey:
              raw.correctAlternative ??
              (
                raw.alternatives.find(
                  (alternative) =>
                    alternative.isCorrect,
                )?.letter ?? null
              ),
            examinationExternalIds: [
              `enem-${year}`,
            ],
            discipline:
              disciplineLabels.get(
                raw.discipline,
              ) ??
              raw.discipline,
            topic: null,
            supportTextsHtml:
              supportTexts,
            attachmentUrls,
            hasImages:
              attachmentUrls.length > 0 ||
              markdownHasImage(
                context,
              ) ||
              markdownHasImage(
                introduction,
              ),
            hasAnswerKey:
              Boolean(
                raw.correctAlternative ??
                  raw.alternatives.find(
                    (alternative) =>
                      alternative.isCorrect,
                  )?.letter,
              ),
            hasSupportText:
              supportTexts.length > 0,
            sourceUrl:
              `https://github.com/yunger7/enem-api/blob/main/public/${year}/questions/${sourcePath}/details.json`,
            rawPayload: raw,
          };
        },
      );

    const nextCursor =
      input.externalId ||
      startIndex +
        selected.length >=
        ordered.length
        ? null
        : (
            selected.at(-1)
              ?.externalId ?? null
          );

    return {
      total: ordered.length,
      nextCursor,
      correlationId: null,
      items,
    };
  }

  public async getExamination(
    externalId: string,
  ): Promise<ProviderExaminationMetadata | null> {
    const year = parseYear(
      externalId,
    );

    return {
      externalId:
        `enem-${year}`,
      title: `ENEM ${year}`,
      slugPrefix: "enem",
      organization: "INEP",
      careerPosition: null,
      year,
      board: null,
      alternativeType:
        "MULTIPLA_ESCOLHA",
    };
  }
}
