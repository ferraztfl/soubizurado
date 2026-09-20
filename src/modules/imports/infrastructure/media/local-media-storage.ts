import {
  mkdir,
  writeFile,
} from "node:fs/promises";
import {
  dirname,
  resolve,
} from "node:path";

import type {
  MediaStorage,
} from "../../application/ports/media-ingestion";

export type LocalMediaStorageOptions =
  Readonly<{
    rootDirectory: string;
    bucket?: string;
  }>;

export class LocalMediaStorage
  implements MediaStorage
{
  public readonly provider =
    "LOCAL_FS";

  public readonly bucket:
    string;

  private readonly rootDirectory:
    string;

  public constructor(
    options:
      LocalMediaStorageOptions,
  ) {
    this.rootDirectory =
      resolve(
        options.rootDirectory,
      );

    this.bucket =
      options.bucket ??
      "question-media";
  }

  public async put(
    input: Readonly<{
      storageKey: string;
      mimeType: string;
      bytes: Uint8Array;
    }>,
  ): Promise<void> {
    const target =
      resolve(
        this.rootDirectory,
        input.storageKey,
      );

    if (
      !target.startsWith(
        this.rootDirectory,
      )
    ) {
      throw new Error(
        "Invalid media storage key.",
      );
    }

    await mkdir(
      dirname(target),
      {
        recursive: true,
      },
    );

    await writeFile(
      target,
      input.bytes,
    );
  }
}