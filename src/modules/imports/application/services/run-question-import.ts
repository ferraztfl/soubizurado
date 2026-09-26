import type {
  ImportProviderQuestionsInput,
  ImportProviderQuestionsOutput,
} from "../use-cases/import-provider-questions";

export type QuestionImportPageExecutor = (
  input: ImportProviderQuestionsInput,
) => Promise<ImportProviderQuestionsOutput>;

export type QuestionImportAggregateCounts =
  Readonly<{
    received: number;
    imported: number;
    duplicates: number;
    reviewRequired: number;
    failed: number;
  }>;

export type RunQuestionImportOutput =
  Readonly<{
    pages: number;
    jobs: readonly string[];
    counts: QuestionImportAggregateCounts;
    nextCursor: string | null;
  }>;

export type RunQuestionImportInput =
  Readonly<{
    executePage: QuestionImportPageExecutor;
    pageInput:
      ImportProviderQuestionsInput;
    all: boolean;
    maxPages?: number;
    onPage?: (
      input: Readonly<{
        index: number;
        result:
          ImportProviderQuestionsOutput;
      }>,
    ) => void | Promise<void>;
  }>;

function emptyCounts(): {
  received: number;
  imported: number;
  duplicates: number;
  reviewRequired: number;
  failed: number;
} {
  return {
    received: 0,
    imported: 0,
    duplicates: 0,
    reviewRequired: 0,
    failed: 0,
  };
}

export async function runQuestionImport(
  input: RunQuestionImportInput,
): Promise<RunQuestionImportOutput> {
  if (
    input.maxPages !== undefined &&
    (
      !Number.isSafeInteger(
        input.maxPages,
      ) ||
      input.maxPages < 1
    )
  ) {
    throw new Error(
      "maxPages must be a positive integer.",
    );
  }

  const {
    afterId: initialAfterId,
    ...basePageInput
  } = input.pageInput;

  const counts = emptyCounts();
  const jobs: string[] = [];

  let afterId =
    initialAfterId;
  let pages = 0;
  let nextCursor:
    string | null = null;

  do {
    const result =
      await input.executePage({
        ...basePageInput,
        afterId,
      });

    pages += 1;
    jobs.push(result.jobId);

    counts.received +=
      result.received;
    counts.imported +=
      result.imported;
    counts.duplicates +=
      result.duplicates;
    counts.reviewRequired +=
      result.reviewRequired;
    counts.failed +=
      result.failed;

    nextCursor =
      result.nextCursor;

    await input.onPage?.({
      index: pages,
      result,
    });

    if (
      !input.all ||
      basePageInput.externalId ||
      !result.nextCursor
    ) {
      break;
    }

    if (
      result.nextCursor ===
      afterId
    ) {
      throw new Error(
        "Question import cursor did not advance.",
      );
    }

    afterId =
      result.nextCursor;

    if (
      input.maxPages !== undefined &&
      pages >= input.maxPages
    ) {
      break;
    }
  } while (true);

  return {
    pages,
    jobs,
    counts,
    nextCursor,
  };
}