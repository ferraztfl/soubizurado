import {
  readFile,
  stat,
} from "node:fs/promises";
import {
  extname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";

import type {
  MediaBinary,
  MediaSourceReader,
} from "../../application/ports/media-ingestion";

export type StagedMediaSourceReaderOptions =
  Readonly<{
    rootDirectory: string;
    maxBytes?: number;
  }>;

function mimeTypeFromPath(
  path: string,
): string {
  const extension =
    extname(path)
      .toLocaleLowerCase(
        "en-US",
      );

  const mimeTypes:
    Readonly<Record<string, string>> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".gif": "image/gif",
      ".svg": "image/svg+xml",
      ".pdf": "application/pdf",
    };

  const mimeType =
    mimeTypes[extension];

  if (!mimeType) {
    throw new Error(
      `Unsupported staged media extension: ${extension || "<none>"}.`,
    );
  }

  return mimeType;
}

function isInsideRoot(
  root: string,
  target: string,
): boolean {
  const path =
    relative(
      root,
      target,
    );

  return (
    path === "" ||
    (
      path !== ".." &&
      !path.startsWith(
        `..${sep}`,
      ) &&
      !isAbsolute(path)
    )
  );
}

export class StagedMediaSourceReader
  implements MediaSourceReader
{
  private readonly rootDirectory:
    string;

  private readonly maxBytes:
    number;

  public constructor(
    options:
      StagedMediaSourceReaderOptions,
  ) {
    this.rootDirectory =
      resolve(
        options.rootDirectory,
      );

    this.maxBytes =
      options.maxBytes ??
      25 * 1024 * 1024;
  }

  public async read(
    sourceUrl: string,
  ): Promise<MediaBinary> {
    let url: URL;

    try {
      url =
        new URL(
          sourceUrl,
        );
    } catch {
      throw new Error(
        `Invalid staged media URL: ${sourceUrl}`,
      );
    }

    if (
      url.protocol !== "staging:" ||
      url.hostname !== "local"
    ) {
      throw new Error(
        `Unsupported staged media URL: ${sourceUrl}`,
      );
    }

    const relativePath =
      decodeURIComponent(
        url.pathname,
      )
        .replace(
          /^\/+/,
          "",
        )
        .replace(
          /\//g,
          sep,
        );

    if (!relativePath) {
      throw new Error(
        "Staged media URL has no path.",
      );
    }

    const target =
      resolve(
        this.rootDirectory,
        relativePath,
      );

    if (
      !isInsideRoot(
        this.rootDirectory,
        target,
      )
    ) {
      throw new Error(
        "Staged media path escapes the configured root.",
      );
    }

    const info =
      await stat(target);

    if (!info.isFile()) {
      throw new Error(
        `Staged media is not a file: ${sourceUrl}`,
      );
    }

    if (
      info.size >
      this.maxBytes
    ) {
      throw new Error(
        `Staged media exceeds maximum size of ${this.maxBytes} bytes.`,
      );
    }

    const bytes =
      new Uint8Array(
        await readFile(target),
      );

    return {
      bytes,
      mimeType:
        mimeTypeFromPath(
          target,
        ),
      sourceUrl,
    };
  }
}