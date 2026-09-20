import type {
  MediaBinary,
  MediaSourceReader,
} from "../../application/ports/media-ingestion";

type Fetcher =
  typeof fetch;

export type HttpMediaSourceReaderOptions =
  Readonly<{
    fetcher?: Fetcher;
    maxBytes?: number;
  }>;

const ALLOWED_MIME_PREFIXES = [
  "image/",
] as const;

const ALLOWED_MIME_TYPES =
  new Set([
    "application/pdf",
  ]);

function normalizedMimeType(
  value: string | null,
): string {
  return (
    value
      ?.split(";")[0]
      ?.trim()
      .toLocaleLowerCase(
        "en-US",
      ) ??
    "application/octet-stream"
  );
}

function validateMimeType(
  mimeType: string,
): void {
  if (
    ALLOWED_MIME_TYPES.has(
      mimeType,
    ) ||
    ALLOWED_MIME_PREFIXES.some(
      (prefix) =>
        mimeType.startsWith(
          prefix,
        ),
    )
  ) {
    return;
  }

  throw new Error(
    `Unsupported media MIME type: ${mimeType}.`,
  );
}

export class HttpMediaSourceReader
  implements MediaSourceReader
{
  private readonly fetcher:
    Fetcher;
  private readonly maxBytes:
    number;

  public constructor(
    options:
      HttpMediaSourceReaderOptions = {},
  ) {
    this.fetcher =
      options.fetcher ??
      fetch;

    this.maxBytes =
      options.maxBytes ??
      25 * 1024 * 1024;

    if (
      !Number.isSafeInteger(
        this.maxBytes,
      ) ||
      this.maxBytes < 1
    ) {
      throw new Error(
        "Media maxBytes must be a positive integer.",
      );
    }
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
        `Invalid media URL: ${sourceUrl}`,
      );
    }

    if (
      url.protocol !==
        "https:" &&
      url.protocol !==
        "http:"
    ) {
      throw new Error(
        `Unsupported media protocol: ${url.protocol}`,
      );
    }

    const response =
      await this.fetcher(
        url,
        {
          method: "GET",
          redirect:
            "follow",
          headers: {
            Accept:
              "image/*,application/pdf;q=0.9,*/*;q=0.1",
          },
        },
      );

    if (!response.ok) {
      throw new Error(
        `Media download failed with status ${response.status}: ${sourceUrl}`,
      );
    }

    const declaredLength =
      Number(
        response.headers.get(
          "content-length",
        ) ?? "0",
      );

    if (
      Number.isFinite(
        declaredLength,
      ) &&
      declaredLength >
        this.maxBytes
    ) {
      throw new Error(
        `Media exceeds maximum size of ${this.maxBytes} bytes.`,
      );
    }

    const mimeType =
      normalizedMimeType(
        response.headers.get(
          "content-type",
        ),
      );

    validateMimeType(
      mimeType,
    );

    const buffer =
      await response
        .arrayBuffer();

    if (
      buffer.byteLength >
      this.maxBytes
    ) {
      throw new Error(
        `Media exceeds maximum size of ${this.maxBytes} bytes.`,
      );
    }

    return {
      bytes:
        new Uint8Array(
          buffer,
        ),
      mimeType,
      sourceUrl:
        url.toString(),
    };
  }
}