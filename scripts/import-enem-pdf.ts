import "dotenv/config";

import {
  resolve,
} from "node:path";

import {
  ImportProviderQuestionsUseCase,
} from "../src/modules/imports/application/use-cases/import-provider-questions";
import {
  EnemPdfProvider,
} from "../src/modules/imports/infrastructure/providers/enem-pdf-provider";
import {
  createConfiguredQuestionImportRepository,
  type QuestionImportSourceConfig,
} from "../src/modules/imports/infrastructure/repositories/prisma-question-import-repository";

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

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing from the environment.",
    );
  }

  const pdfRaw =
    argumentValue("pdf");

  if (!pdfRaw) {
    throw new Error(
      "Use --pdf=<path-to-pdf>.",
    );
  }

  const year =
    Number(
      argumentValue("ano") ??
        "2024",
    );

  if (hasFlag("publish")) {
    throw new Error(
      "ENEM PDF imports are review-first. --publish is intentionally disabled.",
    );
  }

  const pdfPath =
    resolve(pdfRaw);

  const sourceUrl =
    argumentValue(
      "source-url",
    ) ??
    "https://questoes.grancursosonline.com.br/";

  const provider =
    new EnemPdfProvider({
      pdfPath,
      year,
      sourceUrl,
    });
  const inspection =
    await provider.inspect();

  const expectedTotalRaw =
    argumentValue(
      "expected-total",
    );

  if (expectedTotalRaw) {
    const expectedTotal =
      Number(
        expectedTotalRaw,
      );

    if (
      !Number.isSafeInteger(
        expectedTotal,
      ) ||
      expectedTotal < 1
    ) {
      throw new Error(
        "--expected-total must be a positive integer.",
      );
    }

    if (
      inspection.total !==
      expectedTotal
    ) {
      throw new Error(
        `Expected ${expectedTotal} ENEM PDF questions, parsed ${inspection.total}.`,
      );
    }
  }

  if (
    inspection.total < 1
  ) {
    throw new Error(
      "ENEM PDF did not produce any questions.",
    );
  }

  if (
    inspection.answerKeyCount !==
    inspection.total
  ) {
    throw new Error(
      `Expected an answer key for every parsed question; found ${inspection.answerKeyCount}/${inspection.total}.`,
    );
  }

  const sourceReference =
    argumentValue(
      "source-ref",
    ) ??
    `gran-enem-${year}-pdf-${inspection.checksum.slice(
      0,
      16,
    )}`;

  const sourceName =
    argumentValue(
      "source-name",
    ) ??
    `Gran Cursos Questões - ENEM ${year} PDF export`;

  const sourceConfig:
    QuestionImportSourceConfig = {
      providerCode:
        "ENEM_PDF_GRAN",
      reference:
        sourceReference,
      name:
        sourceName,
      url:
        sourceUrl,
      sourceType:
        "OTHER",
      licenseStatus:
        "UNKNOWN",
      licenseName: null,
      licenseNotes:
        "User-supplied PDF export from Gran Cursos Questões. Underlying question provenance is identified in the document as INEP/ENEM. Do not infer redistribution rights for the PDF packaging, images, or question assets.",
    };

  const repository =
    createConfiguredQuestionImportRepository(
      sourceConfig,
    );
  const useCase =
    new ImportProviderQuestionsUseCase(
      provider,
      repository,
    );

  let afterId:
    string | undefined;
  const totals = {
    received: 0,
    imported: 0,
    duplicates: 0,
    reviewRequired: 0,
    failed: 0,
  };
  const jobs:
    string[] = [];

  do {
    const result =
      await useCase.execute({
        limit: 100,
        examinationId:
          `enem-${year}`,
        afterId,
        publish: false,
        filters: {
          year:
            String(year),
        },
      });

    jobs.push(
      result.jobId,
    );
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

    if (!result.nextCursor) {
      break;
    }

    if (
      result.nextCursor ===
      afterId
    ) {
      throw new Error(
        "ENEM PDF import cursor did not advance.",
      );
    }

    afterId =
      result.nextCursor;
  } while (true);

  process.stdout.write(
    `\n${JSON.stringify(
      {
        summary: {
          year,
          documentChecksum:
            inspection.checksum,
          parsed:
            inspection.total,
          visualQuestions:
            inspection
              .visualQuestionCount,
          blankAlternativeQuestions:
            inspection
              .blankAlternativeQuestionCount,
          mediaReferences:
            inspection
              .mediaReferenceCount,
          questionMediaReferences:
            inspection
              .questionMediaReferenceCount,
          alternativeMediaReferences:
            inspection
              .alternativeMediaReferenceCount,
          jobs,
          ...totals,
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
      : "Unknown ENEM PDF import error.";

  process.stderr.write(
    `ENEM PDF import failed: ${message}\n`,
  );
  process.exitCode = 1;
});
