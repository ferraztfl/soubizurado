import {
  request as httpRequest,
  type IncomingMessage,
} from "node:http";
import {
  request as httpsRequest,
} from "node:https";
import {
  isIP,
} from "node:net";
import {
  buffer as consumeBuffer,
} from "node:stream/consumers";

import type {
  MediaBinary,
  MediaSourceReader,
} from "../../application/ports/media-ingestion";

import {
  resolvePublicMediaAddress,
  type MediaHostResolver,
  type ResolvedMediaAddress,
} from "./public-media-network-policy";

export type HttpMediaSourceReaderOptions =
  Readonly<{
    maxBytes?: number;
    timeoutMs?: number;
    maxRedirects?: number;
    resolver?: MediaHostResolver;
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

function validateUrl(
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

  if (
    url.username ||
    url.password
  ) {
    throw new Error(
      "Media URLs with credentials are not allowed.",
    );
  }
}

function headerValue(
  value:
    | string
    | string[]
    | undefined,
): string | null {
  if (
    Array.isArray(
      value,
    )
  ) {
    return (
      value[0] ??
      null
    );
  }

  return value ?? null;
}

function hostnameWithoutBrackets(
  hostname: string,
): string {
  if (
    hostname.startsWith("[") &&
    hostname.endsWith("]")
  ) {
    return hostname.slice(
      1,
      -1,
    );
  }

  return hostname;
}

function requestPinned(
  url: URL,
  resolved:
    ResolvedMediaAddress,
  signal:
    AbortSignal,
): Promise<IncomingMessage> {
  const originalHostname =
    hostnameWithoutBrackets(
      url.hostname,
    );

  const commonOptions = {
    hostname:
      resolved.address,
    family:
      resolved.family,
    port:
      url.port ||
      undefined,
    method:
      "GET",
    path:
      `${url.pathname}${url.search}`,
    signal,
    headers: {
      Accept:
        "image/*,application/pdf;q=0.9,*/*;q=0.1",
      Host:
        url.host,
    },
  };

  return new Promise(
    (
      resolve,
      reject,
    ) => {
      const onResponse =
        (
          response:
            IncomingMessage,
        ) => {
          resolve(
            response,
          );
        };

      const request =
        url.protocol ===
        "https:"
          ? httpsRequest(
              {
                ...commonOptions,
                servername:
                  isIP(
                    originalHostname,
                  ) === 0
                    ? originalHostname
                    : undefined,
              },
              onResponse,
            )
          : httpRequest(
              commonOptions,
              onResponse,
            );

      request.once(
        "error",
        reject,
      );

      request.end();
    },
  );
}

export class HttpMediaSourceReader
  implements MediaSourceReader
{
  private readonly maxBytes:
    number;

  private readonly timeoutMs:
    number;

  private readonly maxRedirects:
    number;

  private readonly resolver:
    MediaHostResolver | undefined;

  public constructor(
    options:
      HttpMediaSourceReaderOptions = {},
  ) {
    this.maxBytes =
      options.maxBytes ??
      25 * 1024 * 1024;

    this.timeoutMs =
      options.timeoutMs ??
      15_000;

    this.maxRedirects =
      options.maxRedirects ??
      5;

    this.resolver =
      options.resolver;

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

    try {
      while (true) {
        validateUrl(
          currentUrl,
        );

        const resolved =
          await resolvePublicMediaAddress(
            currentUrl.hostname,
            this.resolver,
          );

        const response =
          await requestPinned(
            currentUrl,
            resolved,
            signal,
          );

        const status =
          response.statusCode ??
          0;

        if (
          REDIRECT_STATUSES.has(
            status,
          )
        ) {
          const location =
            headerValue(
              response.headers
                .location,
            );

          response.destroy();

          if (
            redirectCount >=
            this.maxRedirects
          ) {
            throw new Error(
              `Media redirect limit exceeded: ${sourceUrl}`,
            );
          }

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

          redirectCount +=
            1;

          continue;
        }

        if (
          status < 200 ||
          status >= 300
        ) {
          response.destroy();

          throw new Error(
            `Media download failed with status ${status}: ${currentUrl.toString()}`,
          );
        }

        const declaredLength =
          Number(
            headerValue(
              response.headers[
                "content-length"
              ],
            ) ??
              "0",
          );

        if (
          Number.isFinite(
            declaredLength,
          ) &&
          declaredLength >
            this.maxBytes
        ) {
          response.destroy();

          throw new Error(
            `Media exceeds maximum size of ${this.maxBytes} bytes.`,
          );
        }

        const mimeType =
          normalizedMimeType(
            headerValue(
              response.headers[
                "content-type"
              ],
            ),
          );

        try {
          validateMimeType(
            mimeType,
          );
        } catch (error) {
          response.destroy();

          throw error;
        }

        const buffer =
          await consumeBuffer(
            response,
          );

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
    } catch (error) {
      if (
        signal.aborted
      ) {
        throw new Error(
          `Media download timed out after ${this.timeoutMs} ms: ${sourceUrl}`,
        );
      }

      throw error;
    }
  }
}
