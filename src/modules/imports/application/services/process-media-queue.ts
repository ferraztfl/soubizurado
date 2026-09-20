import {
  createHash,
} from "node:crypto";

import type {
  ClaimedMediaTask,
  MediaSourceReader,
  MediaStorage,
  MediaTaskRepository,
} from "../ports/media-ingestion";

export type ProcessMediaQueueInput =
  Readonly<{
    repository: MediaTaskRepository;
    reader: MediaSourceReader;
    storage: MediaStorage;
    concurrency: number;
    limit: number;
    maxAttempts: number;
    staleMinutes: number;
  }>;

export type ProcessMediaQueueOutput =
  Readonly<{
    recovered: number;
    claimed: number;
    completed: number;
    retried: number;
    failed: number;
  }>;

function checksum(
  bytes: Uint8Array,
): string {
  return createHash("sha256")
    .update(bytes)
    .digest("hex");
}

function extensionForMimeType(
  mimeType: string,
): string {
  const normalized =
    mimeType
      .split(";")[0]
      ?.trim()
      .toLocaleLowerCase(
        "en-US",
      ) ?? "";

  const extensions:
    Readonly<Record<string, string>> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/svg+xml": "svg",
      "application/pdf": "pdf",
    };

  return extensions[normalized] ??
    "bin";
}

export function mediaStorageKey(
  checksumValue: string,
  mimeType: string,
): string {
  return [
    "sha256",
    checksumValue.slice(0, 2),
    checksumValue.slice(2, 4),
    `${checksumValue}.${extensionForMimeType(
      mimeType,
    )}`,
  ].join("/");
}

async function processOne(
  input: ProcessMediaQueueInput,
  task: ClaimedMediaTask,
): Promise<
  "COMPLETED" | "RETRIED" | "FAILED"
> {
  try {
    const binary =
      await input.reader.read(
        task.sourceUrl,
      );

    const checksumValue =
      checksum(binary.bytes);

    let asset =
      await input.repository
        .findAssetByChecksum(
          checksumValue,
        );

    if (!asset) {
      const storageKey =
        mediaStorageKey(
          checksumValue,
          binary.mimeType,
        );

      await input.storage.put({
        storageKey,
        mimeType:
          binary.mimeType,
        bytes:
          binary.bytes,
      });

      asset =
        await input.repository
          .persistAsset({
            checksum:
              checksumValue,
            storageProvider:
              input.storage.provider,
            bucket:
              input.storage.bucket,
            storageKey,
            mimeType:
              binary.mimeType,
            sizeBytes:
              BigInt(
                binary.bytes
                  .byteLength,
              ),
            sourceUrl:
              task.sourceUrl,
          });
    }

    await input.repository.completeTask({
      task,
      mediaAssetId:
        asset.id,
    });

    return "COMPLETED";
  } catch (error) {
    const status =
      await input.repository
        .retryOrFailTask({
          taskId:
            task.id,
          maxAttempts:
            input.maxAttempts,
          message:
            error instanceof Error
              ? error.message
              : "Unknown media processing failure.",
        });

    return status === "FAILED"
      ? "FAILED"
      : "RETRIED";
  }
}

async function mapWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  mapper: (
    item: T,
  ) => Promise<
    "COMPLETED" |
    "RETRIED" |
    "FAILED"
  >,
): Promise<
  readonly (
    "COMPLETED" |
    "RETRIED" |
    "FAILED"
  )[]
> {
  const results =
    new Array<
      "COMPLETED" |
      "RETRIED" |
      "FAILED"
    >(
      items.length,
    );

  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (
      nextIndex <
      items.length
    ) {
      const index =
        nextIndex;

      nextIndex += 1;

      results[index] =
        await mapper(
          items[index]!,
        );
    }
  }

  await Promise.all(
    Array.from(
      {
        length:
          Math.min(
            concurrency,
            items.length,
          ),
      },
      () => worker(),
    ),
  );

  return results;
}

export async function processMediaQueue(
  input: ProcessMediaQueueInput,
): Promise<ProcessMediaQueueOutput> {
  if (
    !Number.isSafeInteger(
      input.concurrency,
    ) ||
    input.concurrency < 1 ||
    input.concurrency > 32
  ) {
    throw new Error(
      "Media concurrency must be between 1 and 32.",
    );
  }

  if (
    !Number.isSafeInteger(
      input.limit,
    ) ||
    input.limit < 1 ||
    input.limit > 10_000
  ) {
    throw new Error(
      "Media limit must be between 1 and 10000.",
    );
  }

  if (
    !Number.isSafeInteger(
      input.maxAttempts,
    ) ||
    input.maxAttempts < 1 ||
    input.maxAttempts > 20
  ) {
    throw new Error(
      "Media maxAttempts must be between 1 and 20.",
    );
  }

  const recovered =
    await input.repository
      .recoverStaleTasks(
        input.staleMinutes,
      );

  let claimed = 0;
  let completed = 0;
  let retried = 0;
  let failed = 0;

  while (
    claimed <
    input.limit
  ) {
    const remaining =
      input.limit - claimed;

    const batch =
      await input.repository
        .claimTasks(
          Math.min(
            input.concurrency,
            remaining,
          ),
        );

    if (
      batch.length === 0
    ) {
      break;
    }

    claimed +=
      batch.length;

    const results =
      await mapWithConcurrency(
        batch,
        input.concurrency,
        (task) =>
          processOne(
            input,
            task,
          ),
      );

    for (
      const result of results
    ) {
      if (
        result ===
        "COMPLETED"
      ) {
        completed += 1;
      } else if (
        result ===
        "RETRIED"
      ) {
        retried += 1;
      } else {
        failed += 1;
      }
    }
  }

  return {
    recovered,
    claimed,
    completed,
    retried,
    failed,
  };
}