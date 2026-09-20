import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  ClaimedMediaTask,
  MediaSourceReader,
  MediaStorage,
  MediaTaskRepository,
  PersistedMediaAsset,
} from "../ports/media-ingestion";

import {
  mediaStorageKey,
  processMediaQueue,
} from "./process-media-queue";

class FakeRepository
  implements MediaTaskRepository
{
  public tasks:
    ClaimedMediaTask[] = [];

  public assets =
    new Map<
      string,
      PersistedMediaAsset
    >();

  public completed:
    string[] = [];

  public failures:
    string[] = [];

  public async recoverStaleTasks() {
    return 0;
  }

  public async claimTasks(
    limit: number,
  ) {
    return this.tasks.splice(
      0,
      limit,
    );
  }

  public async findAssetByChecksum(
    checksum: string,
  ) {
    return (
      this.assets.get(
        checksum,
      ) ?? null
    );
  }

  public async persistAsset(
    input: Readonly<{
      checksum: string;
      storageProvider: string;
      bucket: string;
      storageKey: string;
      mimeType: string;
      sizeBytes: bigint;
      sourceUrl: string;
    }>,
  ) {
    const asset = {
      id:
        `asset-${this.assets.size + 1}`,
      checksum:
        input.checksum,
      storageProvider:
        input.storageProvider,
      bucket:
        input.bucket,
      storageKey:
        input.storageKey,
      mimeType:
        input.mimeType,
      sizeBytes:
        input.sizeBytes,
    };

    this.assets.set(
      input.checksum,
      asset,
    );

    return asset;
  }

  public async completeTask(
    input: Readonly<{
      task: ClaimedMediaTask;
      mediaAssetId: string;
    }>,
  ) {
    this.completed.push(
      input.task.id,
    );
  }

  public async retryOrFailTask(
    input: Readonly<{
      taskId: string;
      maxAttempts: number;
      message: string;
    }>,
  ) {
    this.failures.push(
      input.taskId,
    );

    return "FAILED" as const;
  }
}

class FakeReader
  implements MediaSourceReader
{
  public async read(
    sourceUrl: string,
  ) {
    return {
      sourceUrl,
      mimeType:
        "image/png",
      bytes:
        new Uint8Array([
          1,
          2,
          3,
          4,
        ]),
    };
  }
}

class FakeStorage
  implements MediaStorage
{
  public readonly provider =
    "TEST";

  public readonly bucket =
    "test-media";

  public writes:
    string[] = [];

  public async put(
    input: Readonly<{
      storageKey: string;
      mimeType: string;
      bytes: Uint8Array;
    }>,
  ) {
    this.writes.push(
      input.storageKey,
    );
  }
}

function task(
  id: string,
): ClaimedMediaTask {
  return {
    id,
    importItemId:
      `item-${id}`,
    questionId:
      `question-${id}`,
    sourceUrl:
      `https://example.test/${id}.png`,
    role:
      "QUESTION_ATTACHMENT",
    alternativeLabel: "",
    position: 0,
    attempts: 1,
  };
}

describe(
  "processMediaQueue",
  () => {
    it(
      "downloads, stores and completes queued media",
      async () => {
        const repository =
          new FakeRepository();

        repository.tasks = [
          task("1"),
          task("2"),
        ];

        const storage =
          new FakeStorage();

        const result =
          await processMediaQueue({
            repository,
            reader:
              new FakeReader(),
            storage,
            concurrency: 1,
            limit: 10,
            maxAttempts: 3,
            staleMinutes: 15,
          });

        expect(result).toEqual({
          recovered: 0,
          claimed: 2,
          completed: 2,
          retried: 0,
          failed: 0,
        });

        expect(
          repository.completed,
        ).toEqual([
          "1",
          "2",
        ]);

        expect(
          repository.assets.size,
        ).toBe(1);

        expect(
          storage.writes,
        ).toHaveLength(1);
      },
    );

    it(
      "builds deterministic content-addressed keys",
      () => {
        const checksum =
          "a".repeat(64);

        expect(
          mediaStorageKey(
            checksum,
            "image/png",
          ),
        ).toBe(
          `sha256/aa/aa/${checksum}.png`,
        );
      },
    );
  },
);