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
  year: number;
  limit: number;
  all: boolean;
  afterId?: string;
  externalId?: string;
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

function parseArguments(): Arguments {
  const yearRaw =
    argumentValue("ano");
  const year = Number(yearRaw);

  if (
    !Number.isSafeInteger(year) ||
    year < 2009 ||
    year > 2100
  ) {
    throw new Error(
      "--ano is required and must be a valid ENEM year.",
    );
  }

  const limit = Number(
    argumentValue("limit") ??
      "20",
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

  if (
    externalId &&
    hasFlag("all")
  ) {
    throw new Error(
      "Use either --id or --all, not both.",
    );
  }

  if (hasFlag("publish")) {
    throw new Error(
      "ENEM imports are review-first. --publish is intentionally disabled.",
    );
  }

  return {
    year,
    limit:
      externalId ? 1 : limit,
    all: hasFlag("all"),
    afterId:
      argumentValue("after-id"),
    externalId,
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

  let afterId =
    args.afterId;
  const jobs: string[] = [];
  const totals = {
    received: 0,
    imported: 0,
    duplicates: 0,
    reviewRequired: 0,
    failed: 0,
  };

  do {
    const result =
      await useCase.execute({
        limit: args.limit,
        externalId:
          args.externalId,
        examinationId:
          `enem-${args.year}`,
        afterId,
        publish: false,
        filters: {
          year:
            String(args.year),
        },
      });

    jobs.push(result.jobId);
    totals.received +=
      result.received;
    totals.imported +=
      result.imported;
    totals.duplicates +=
      result.duplicates;
    totals.reviewRequired +=
      result.reviewRequired;
    totals.failed +=
      result.failed;

    const previousAfterId =
      afterId;
    afterId =
      result.nextCursor ??
      undefined;

    process.stdout.write(
      `${JSON.stringify(
        {
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
      !args.all ||
      args.externalId ||
      !afterId
    ) {
      break;
    }

    if (
      afterId ===
      previousAfterId
    ) {
      throw new Error(
        "ENEM import cursor did not advance.",
      );
    }
  } while (true);

  process.stdout.write(
    `${JSON.stringify(
      {
        summary: {
          year: args.year,
          jobs,
          ...totals,
          nextCursor:
            afterId ?? null,
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
