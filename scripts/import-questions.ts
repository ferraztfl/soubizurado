import "dotenv/config";

import {
  resolve,
} from "node:path";

import {
  runQuestionImport,
} from "../src/modules/imports/application/services/run-question-import";
import {
  ImportProviderQuestionsUseCase,
} from "../src/modules/imports/application/use-cases/import-provider-questions";
import type {
  QuestionImportRepository,
} from "../src/modules/imports/application/ports/question-import-repository";
import type {
  QuestionProvider,
  QuestionProviderListInput,
} from "../src/modules/imports/application/ports/question-provider";
import {
  EnemDataProvider,
} from "../src/modules/imports/infrastructure/providers/enem-data-provider";
import {
  EnemPdfProvider,
} from "../src/modules/imports/infrastructure/providers/enem-pdf-provider";
import {
  QuestApiProvider,
} from "../src/modules/imports/infrastructure/providers/quest-api-provider";
import {
  createConfiguredQuestionImportRepository,
  PrismaQuestionImportRepository,
  type QuestionImportSourceConfig,
} from "../src/modules/imports/infrastructure/repositories/prisma-question-import-repository";

type ProviderName =
  | "enem-data"
  | "enem-pdf"
  | "quest-api";

type Arguments = Readonly<{
  provider: ProviderName;
  limit: number;
  maxPages?: number;
  all: boolean;
  publish: boolean;
  year: number | null;
  pdf?: string;
  externalId?: string;
  examinationId?: string;
  afterId?: string;
  board?: string;
  discipline?: string;
  topic?: string;
  hasAttachments?: boolean;
  sourceReference?: string;
  sourceName?: string;
  sourceUrl?: string;
}>;

function argumentValue(
  name: string,
): string | undefined {
  const prefix =
    `--${name}=`;

  return process.argv
    .slice(2)
    .find((argument) =>
      argument.startsWith(
        prefix,
      ),
    )
    ?.slice(
      prefix.length,
    )
    .trim();
}

function hasFlag(
  name: string,
): boolean {
  return process.argv
    .slice(2)
    .includes(
      `--${name}`,
    );
}

function printHelp(): void {
  process.stdout.write(`
SouBizurado - Generic Question Import

Providers:
  --provider=enem-data
  --provider=enem-pdf
  --provider=quest-api

Common options:
  --limit=100
  --all
  --max-pages=1000
  --after-id=<cursor>
  --id=<external-question-id>

ENEM Data:
  --provider=enem-data --ano=2023 --all

ENEM PDF:
  --provider=enem-pdf --ano=2025 --pdf="D:\\path\\ENEM 2025.pdf"
  PDF imports consume the entire document by default.

Quest API:
  --provider=quest-api --all
  --prova=<exam-id>
  --ano=<year>
  --banca=<board>
  --materia=<discipline>
  --assunto=<topic>
  --com-imagens
  --publish

PDF source metadata:
  --source-ref=<reference>
  --source-name=<name>
  --source-url=<url>
`);
}

function parseInteger(
  value: string | undefined,
  name: string,
  fallback?: number,
): number | undefined {
  if (
    value === undefined &&
    fallback === undefined
  ) {
    return undefined;
  }

  const parsed =
    Number(
      value ??
        String(fallback),
    );

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1
  ) {
    throw new Error(
      `${name} must be a positive integer.`,
    );
  }

  return parsed;
}

function parseYear(
  value: string | undefined,
): number | null {
  if (!value) {
    return null;
  }

  const year = Number(value);

  if (
    !Number.isSafeInteger(year) ||
    year < 2009 ||
    year > 2100
  ) {
    throw new Error(
      "--ano must be between 2009 and 2100.",
    );
  }

  return year;
}

function parseArguments(): Arguments {
  const providerRaw =
    argumentValue(
      "provider",
    )?.toLocaleLowerCase(
      "pt-BR",
    );

  if (
    providerRaw !== "enem-data" &&
    providerRaw !== "enem-pdf" &&
    providerRaw !== "quest-api"
  ) {
    throw new Error(
      "Use --provider=enem-data, --provider=enem-pdf or --provider=quest-api.",
    );
  }

  const limit =
    parseInteger(
      argumentValue("limit"),
      "--limit",
      100,
    )!;

  if (limit > 100) {
    throw new Error(
      "--limit cannot exceed 100 because provider pages are capped at 100.",
    );
  }

  return {
    provider:
      providerRaw,
    limit,
    maxPages:
      parseInteger(
        argumentValue(
          "max-pages",
        ),
        "--max-pages",
      ),
    all:
      hasFlag("all"),
    publish:
      hasFlag("publish"),
    year:
      parseYear(
        argumentValue("ano"),
      ),
    pdf:
      argumentValue("pdf"),
    externalId:
      argumentValue("id"),
    examinationId:
      argumentValue("prova"),
    afterId:
      argumentValue(
        "after-id",
      ),
    board:
      argumentValue("banca"),
    discipline:
      argumentValue(
        "materia",
      ),
    topic:
      argumentValue(
        "assunto",
      ),
    hasAttachments:
      hasFlag("com-imagens")
        ? true
        : undefined,
    sourceReference:
      argumentValue(
        "source-ref",
      ),
    sourceName:
      argumentValue(
        "source-name",
      ),
    sourceUrl:
      argumentValue(
        "source-url",
      ),
  };
}

async function main(): Promise<void> {
  if (hasFlag("help")) {
    printHelp();
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing from the environment.",
    );
  }

  const args =
    parseArguments();

  let provider:
    QuestionProvider;
  let repository:
    QuestionImportRepository;
  let examinationId:
    string | undefined =
      args.examinationId;
  let filters:
    QuestionProviderListInput["filters"];
  let all =
    args.all;
  let metadata:
    unknown = null;

  if (
    args.provider ===
    "enem-data"
  ) {
    if (args.year === null) {
      throw new Error(
        "ENEM data import requires --ano=<year>.",
      );
    }

    if (args.publish) {
      throw new Error(
        "ENEM imports are review-first. --publish is disabled.",
      );
    }

    provider =
      new EnemDataProvider();

    const sourceConfig:
      QuestionImportSourceConfig = {
        providerCode:
          "ENEM_DATA",
        reference:
          "enem-api-yunger7",
        name:
          "ENEM API open dataset",
        url:
          "https://github.com/yunger7/enem-api",
        sourceType:
          "PROVIDER_API",
        licenseStatus:
          "UNKNOWN",
        licenseName:
          "GNU GPL-2.0 (repository)",
        licenseNotes:
          "Dataset imported from the public yunger7/enem-api repository. Preserve ENEM/INEP provenance separately.",
      };

    repository =
      createConfiguredQuestionImportRepository(
        sourceConfig,
      );

    examinationId =
      `enem-${args.year}`;

    filters = {
      year:
        String(args.year),
    };
  } else if (
    args.provider ===
    "enem-pdf"
  ) {
    if (args.year === null) {
      throw new Error(
        "ENEM PDF import requires --ano=<year>.",
      );
    }

    if (!args.pdf) {
      throw new Error(
        "ENEM PDF import requires --pdf=<path>.",
      );
    }

    if (args.publish) {
      throw new Error(
        "ENEM PDF imports are review-first. --publish is disabled.",
      );
    }

    const pdfProvider =
      new EnemPdfProvider({
        pdfPath:
          resolve(args.pdf),
        year:
          args.year,
      });

    const inspection =
      await pdfProvider.inspect();

    provider =
      pdfProvider;

    if (
      inspection.answerKeyCount !==
      inspection.total
    ) {
      throw new Error(
        `Expected an answer key for every parsed question; found ${inspection.answerKeyCount}/${inspection.total}.`,
      );
    }

    const sourceReference =
      args.sourceReference ??
      `gran-enem-${args.year}-pdf-${inspection.checksum.slice(0, 16)}`;

    const sourceConfig:
      QuestionImportSourceConfig = {
        providerCode:
          "ENEM_PDF",
        reference:
          sourceReference,
        name:
          args.sourceName ??
          `ENEM ${args.year} PDF import`,
        url:
          args.sourceUrl ??
          null,
        sourceType:
          "OTHER",
        licenseStatus:
          "UNKNOWN",
        licenseName:
          null,
        licenseNotes:
          "User-supplied ENEM PDF source. Preserve original provenance and do not infer redistribution rights for third-party packaging or assets.",
      };

    repository =
      createConfiguredQuestionImportRepository(
        sourceConfig,
      );

    examinationId =
      `enem-${args.year}`;

    filters = {
      year:
        String(args.year),
    };

    all = true;

    metadata = {
      year:
        args.year,
      documentChecksum:
        inspection.checksum,
      parsed:
        inspection.total,
      answerKeyCount:
        inspection
          .answerKeyCount,
      visualQuestions:
        inspection
          .visualQuestionCount,
      blankAlternativeQuestions:
        inspection
          .blankAlternativeQuestionCount,
    };
  } else {
    const apiKey =
      process.env
        .QUEST_API_KEY
        ?.trim();

    if (!apiKey) {
      throw new Error(
        "QUEST_API_KEY is missing from the environment.",
      );
    }

    provider =
      new QuestApiProvider({
        apiKey,
      });

    repository =
      new PrismaQuestionImportRepository();

    filters = {
      board:
        args.board,
      year:
        args.year === null
          ? undefined
          : String(
              args.year,
            ),
      discipline:
        args.discipline,
      topic:
        args.topic,
      hasAttachments:
        args.hasAttachments,
    };
  }

  const useCase =
    new ImportProviderQuestionsUseCase(
      provider,
      repository,
    );

  const result =
    await runQuestionImport({
      executePage:
        (input) =>
          useCase.execute(
            input,
          ),
      pageInput: {
        limit:
          args.externalId
            ? 1
            : args.limit,
        externalId:
          args.externalId,
        examinationId,
        afterId:
          args.afterId,
        publish:
          args.publish,
        filters,
      },
      all,
      maxPages:
        args.maxPages,
      onPage:
        ({ index, result }) => {
          process.stdout.write(
            `${JSON.stringify(
              {
                page: index,
                ...result,
              },
              null,
              2,
            )}\n`,
          );
        },
    });

  process.stdout.write(
    `\n${JSON.stringify(
      {
        summary: {
          provider:
            args.provider,
          ...metadata &&
            typeof metadata ===
              "object"
            ? metadata
            : {},
          pages:
            result.pages,
          jobs:
            result.jobs,
          ...result.counts,
          nextCursor:
            result.nextCursor,
          publicationMode:
            args.publish
              ? "PUBLISHED"
              : "IN_REVIEW",
        },
      },
      null,
      2,
    )}\n`,
  );
}

main().catch(
  (error: unknown) => {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown question import error.";

    process.stderr.write(
      `Question import failed: ${message}\n`,
    );

    process.exitCode = 1;
  },
);