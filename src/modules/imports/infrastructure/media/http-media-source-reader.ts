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
    timeoutMs?: number;
    maxRedirects?: number;
  }>;

const ALLOWED_MIME_PREFIXES = [
  "image/",
] as const;

const ALLOWED_MIME_TYPES =
  new Set([
    "application/pdf",
  ]);

const REDIRECT_STATUSES =
  new Set([
    301,
    302,
    303,
    307,
    308,
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

function validateProtocol(
  url: URL,
): void {
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
}

export class HttpMediaSourceReader
  implements MediaSourceReader
{
  private readonly fetcher:
    Fetcher;

  private readonly maxBytes:
    number;

  private readonly timeoutMs:
    number;

  private readonly maxRedirects:
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

    this.timeoutMs =
      options.timeoutMs ??
      15_000;

    this.maxRedirects =
      options.maxRedirects ??
      5;

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

    if (
      !Number.isSafeInteger(
        this.timeoutMs,
      ) ||
      this.timeoutMs < 1
    ) {
      throw new Error(
        "Media timeoutMs must be a positive integer.",
      );
    }

    if (
      !Number.isSafeInteger(
        this.maxRedirects,
      ) ||
      this.maxRedirects < 0
    ) {
      throw new Error(
        "Media maxRedirects must be a non-negative integer.",
      );
    }
  }

  public async read(
    sourceUrl: string,
  ): Promise<MediaBinary> {
    let currentUrl: URL;

    try {
      currentUrl =
        new URL(
          sourceUrl,
        );
    } catch {
      throw new Error(
        `Invalid media URL: ${sourceUrl}`,
      );
    }

    const signal =
      AbortSignal.timeout(
        this.timeoutMs,
      );

    let redirectCount =
      0;

    let response:
      Response;

    while (true) {
      validateProtocol(
        currentUrl,
      );

      response =
        await this.fetcher(
          currentUrl,
          {
            method: "GET",
            redirect:
              "manual",
            signal,
            headers: {
              Accept:
                "image/*,application/pdf;q=0.9,*/*;q=0.1",
            },
          },
        );

      if (
        !REDIRECT_STATUSES.has(
          response.status,
        )
      ) {
        break;
      }

      if (
        redirectCount >=
        this.maxRedirects
      ) {
        throw new Error(
          `Media redirect limit exceeded: ${sourceUrl}`,
        );
      }

      const location =
        response.headers.get(
          "location",
        );

      if (!location) {
        throw new Error(
          `Media redirect response is missing Location header: ${currentUrl.toString()}`,
        );
      }

      currentUrl =
        new URL(
          location,
          currentUrl,
        );

      redirectCount += 1;
    }

    if (!response.ok) {
      throw new Error(
        `Media download failed with status ${response.status}: ${currentUrl.toString()}`,
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
        currentUrl.toString(),
    };
  }
}
