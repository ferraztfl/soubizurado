import "dotenv/config";

import {
  resolve,
} from "node:path";

import {
  processMediaQueue,
} from "../src/modules/imports/application/services/process-media-queue";
import {
  HttpMediaSourceReader,
} from "../src/modules/imports/infrastructure/media/http-media-source-reader";
import {
  RoutingMediaSourceReader,
} from "../src/modules/imports/infrastructure/media/routing-media-source-reader";
import {
  StagedMediaSourceReader,
} from "../src/modules/imports/infrastructure/media/staged-media-source-reader";
import {
  createMediaStorage,
} from "../src/modules/imports/infrastructure/media/create-media-storage";
import {
  PrismaMediaTaskRepository,
} from "../src/modules/imports/infrastructure/repositories/prisma-media-task-repository";

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

function integerArgument(
  name: string,
  fallback: number,
): number {
  const value =
    Number(
      argumentValue(name) ??
        String(fallback),
    );

  if (
    !Number.isSafeInteger(value) ||
    value < 1
  ) {
    throw new Error(
      `--${name} must be a positive integer.`,
    );
  }

  return value;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing from the environment.",
    );
  }

  const concurrency =
    integerArgument(
      "concurrency",
      4,
    );

  const limit =
    integerArgument(
      "limit",
      100,
    );

  const maxAttempts =
    integerArgument(
      "max-attempts",
      3,
    );

  const staleMinutes =
    integerArgument(
      "stale-minutes",
      15,
    );

  const maxBytes =
    integerArgument(
      "max-bytes",
      Number(
        process.env.MEDIA_MAX_BYTES ??
          25 * 1024 * 1024,
      ),
    );

  const storageRoot =
    resolve(
      process.env
        .MEDIA_STORAGE_LOCAL_ROOT ??
        "data-private/media-store",
    );

  const repository =
    new PrismaMediaTaskRepository();

  const stagingRoot =
    resolve(
      process.env
        .MEDIA_STAGING_LOCAL_ROOT ??
        "data-private/media-staging",
    );

  const reader =
    new RoutingMediaSourceReader({
      httpReader:
        new HttpMediaSourceReader({
          maxBytes,
        }),
      stagedReader:
        new StagedMediaSourceReader({
          rootDirectory:
            stagingRoot,
          maxBytes,
        }),
    });

  // MEDIA_STORAGE_DRIVER=supabase writes to the private Storage bucket.
  const storage =
    createMediaStorage();

  const result =
    await processMediaQueue({
      repository,
      reader,
      storage,
      concurrency,
      limit,
      maxAttempts,
      staleMinutes,
    });

  process.stdout.write(
    `${JSON.stringify(
      {
        storage: {
          provider:
            storage.provider,
          bucket:
            storage.bucket,
          root:
            storageRoot,
          stagingRoot,
        },
        ...result,
      },
      null,
      2,
    )}\n`,
  );

  if (
    result.failed > 0
  ) {
    process.exitCode = 2;
  }
}

main().catch(
  (error: unknown) => {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown media worker error.";

    process.stderr.write(
      `Media worker failed: ${message}\n`,
    );

    process.exitCode = 1;
  },
);