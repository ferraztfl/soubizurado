import "dotenv/config";

import {
  ImportProviderQuestionsUseCase,
} from "../src/modules/imports/application/use-cases/import-provider-questions";
import {
  EnemDataProvider,
} from "../src/modules/imports/infrastructure/providers/enem-data-provider";
import {
  createConfiguredQuestionImportRepository,
  type QuestionImportSourceConfig,
} from "../src/modules/imports/infrastructure/repositories/prisma-question-import-repository";

const ENEM_SOURCE_CONFIG:
  QuestionImportSourceConfig = {
    providerCode: "ENEM_DATA",
    reference: "enem-api-yunger7",
    name: "ENEM API open dataset",
    url: "https://github.com/yunger7/enem-api",
    sourceType: "PROVIDER_API",
    licenseStatus: "UNKNOWN",
    licenseName:
      "GNU GPL-2.0 (repository)",
    licenseNotes:
      "Dataset imported from the public yunger7/enem-api repository. The repository is GPL-2.0; preserve ENEM/INEP provenance separately and do not infer that every underlying exam asset shares the repository software license.",
  };

type Arguments = Readonly<{
  year: number | null;
  allYears: boolean;
  limit: number;
  all: boolean;
  afterId?: string;
  externalId?: string;
}>;

type ImportCounts = {
  received: number;
  imported: number;
  duplicates: number;
  reviewRequired: number;
  failed: number;
};

type YearSummary = Readonly<{
  year: number;
  jobs: readonly string[];
  counts: Readonly<ImportCounts>;
}>;

function argumentValue(
  name: string,
): string | undefined {
  const prefix = `--${name}=`;

  return process.argv
    .slice(2)
    .find((argument) =>
      argument.startsWith(prefix),
    )
    ?.slice(prefix.length)
    .trim();
}

function hasFlag(
  name: string,
): boolean {
  return process.argv
    .slice(2)
    .includes(`--${name}`);
}

function emptyCounts(): ImportCounts {
  return {
    received: 0,
    imported: 0,
    duplicates: 0,
    reviewRequired: 0,
    failed: 0,
  };
}

function addCounts(
  target: ImportCounts,
  source: Readonly<ImportCounts>,
): void {
  target.received += source.received;
  target.imported += source.imported;
  target.duplicates += source.duplicates;
  target.reviewRequired +=
    source.reviewRequired;
  target.failed += source.failed;
}

function parseArguments(): Arguments {
  const allYears =
    hasFlag("todos-anos");
  const yearRaw =
    argumentValue("ano");
  const year = yearRaw
    ? Number(yearRaw)
    : null;

  if (
    year !== null &&
    (
      !Number.isSafeInteger(year) ||
      year < 2009 ||
      year > 2100
    )
  ) {
    throw new Error(
      "--ano must be a valid ENEM year.",
    );
  }

  if (
    !allYears &&
    year === null
  ) {
    throw new Error(
      "Use --ano=<year> or --todos-anos.",
    );
  }

  if (
    allYears &&
    year !== null
  ) {
    throw new Error(
      "Use either --ano=<year> or --todos-anos, not both.",
    );
  }

  const limit = Number(
    argumentValue("limit") ??
      "100",
  );

  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new Error(
      "--limit must be an integer between 1 and 100.",
    );
  }

  const externalId =
    argumentValue("id");
  const afterId =
    argumentValue("after-id");

  if (
    externalId &&
    (hasFlag("all") || allYears)
  ) {
    throw new Error(
      "Use --id only with a single --ano import.",
    );
  }

  if (
    afterId &&
    allYears
  ) {
    throw new Error(
      "--after-id is only supported with a single --ano import.",
    );
  }

  if (hasFlag("publish")) {
    throw new Error(
      "ENEM imports are review-first. --publish is intentionally disabled.",
    );
  }

  return {
    year,
    allYears,
    limit:
      externalId ? 1 : limit,
    all:
      allYears ||
      hasFlag("all"),
    afterId,
    externalId,
  };
}

async function importYear(
  input: Readonly<{
    year: number;
    limit: number;
    all: boolean;
    afterId?: string;
    externalId?: string;
    useCase:
      ImportProviderQuestionsUseCase;
  }>,
): Promise<YearSummary> {
  let afterId =
    input.afterId;
  const jobs: string[] = [];
  const counts = emptyCounts();

  do {
    const result =
      await input.useCase.execute({
        limit: input.limit,
        externalId:
          input.externalId,
        examinationId:
          `enem-${input.year}`,
        afterId,
        publish: false,
        filters: {
          year:
            String(input.year),
        },
      });

    jobs.push(result.jobId);
    addCounts(counts, result);

    const previousAfterId =
      afterId;
    afterId =
      result.nextCursor ??
      undefined;

    process.stdout.write(
      `${JSON.stringify(
        {
          year: input.year,
          pageJobId:
            result.jobId,
          ...result,
          publicationMode:
            "IN_REVIEW",
        },
        null,
        2,
      )}\n`,
    );

    if (
      !input.all ||
      input.externalId ||
      !afterId
    ) {
      break;
    }

    if (
      afterId ===
      previousAfterId
    ) {
      throw new Error(
        `ENEM ${input.year} import cursor did not advance.`,
      );
    }
  } while (true);

  return {
    year: input.year,
    jobs,
    counts,
  };
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing from the environment.",
    );
  }

  const args = parseArguments();
  const provider =
    new EnemDataProvider();
  const repository =
    createConfiguredQuestionImportRepository(
      ENEM_SOURCE_CONFIG,
    );
  const useCase =
    new ImportProviderQuestionsUseCase(
      provider,
      repository,
    );

  const years = args.allYears
    ? (
        await provider.listAvailableYears()
      ).filter(
        (year) => year >= 2009,
      )
    : [args.year!];

  if (years.length === 0) {
    throw new Error(
      "No ENEM years are available from 2009 onward.",
    );
  }

  const totalCounts =
    emptyCounts();
  const summaries:
    YearSummary[] = [];

  for (const year of years) {
    process.stdout.write(
      `\n=== ENEM ${year} ===\n`,
    );

    const summary =
      await importYear({
        year,
        limit: args.limit,
        all: args.all,
        afterId:
          args.afterId,
        externalId:
          args.externalId,
        useCase,
      });

    summaries.push(summary);
    addCounts(
      totalCounts,
      summary.counts,
    );
  }

  process.stdout.write(
    `\n${JSON.stringify(
      {
        summary: {
          years,
          yearCount:
            years.length,
          perYear:
            summaries,
          ...totalCounts,
          publicationMode:
            "IN_REVIEW",
        },
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : "Unknown ENEM import error.";

  process.stderr.write(
    `ENEM import failed: ${message}\n`,
  );
  process.exitCode = 1;
});
