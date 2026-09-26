export type MediaTaskStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export type ClaimedMediaTask =
  Readonly<{
    id: string;
    importItemId: string;
    questionId: string | null;
    sourceUrl: string;
    role: string;
    alternativeLabel: string;
    position: number;
    attempts: number;
  }>;

export type PersistedMediaAsset =
  Readonly<{
    id: string;
    checksum: string;
    storageProvider: string;
    bucket: string;
    storageKey: string;
    mimeType: string;
    sizeBytes: bigint;
  }>;

export type MediaBinary =
  Readonly<{
    bytes: Uint8Array;
    mimeType: string;
    sourceUrl: string;
  }>;

export interface MediaTaskRepository {
  recoverStaleTasks(
    staleMinutes: number,
  ): Promise<number>;

  claimTasks(
    limit: number,
  ): Promise<readonly ClaimedMediaTask[]>;

  findAssetByChecksum(
    checksum: string,
  ): Promise<PersistedMediaAsset | null>;

  persistAsset(
    input: Readonly<{
      checksum: string;
      storageProvider: string;
      bucket: string;
      storageKey: string;
      mimeType: string;
      sizeBytes: bigint;
      sourceUrl: string;
    }>,
  ): Promise<PersistedMediaAsset>;

  completeTask(
    input: Readonly<{
      task: ClaimedMediaTask;
      mediaAssetId: string;
    }>,
  ): Promise<void>;

  retryOrFailTask(
    input: Readonly<{
      taskId: string;
      maxAttempts: number;
      retryDelaySeconds: number;
      message: string;
    }>,
  ): Promise<"PENDING" | "FAILED">;
}

export interface MediaSourceReader {
  read(
    sourceUrl: string,
  ): Promise<MediaBinary>;
}

export interface MediaStorage {
  readonly provider: string;
  readonly bucket: string;

  put(
    input: Readonly<{
      storageKey: string;
      mimeType: string;
      bytes: Uint8Array;
    }>,
  ): Promise<void>;
}