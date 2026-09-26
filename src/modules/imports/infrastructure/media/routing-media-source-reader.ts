import type {
  MediaBinary,
  MediaSourceReader,
} from "../../application/ports/media-ingestion";

export type RoutingMediaSourceReaderOptions =
  Readonly<{
    httpReader: MediaSourceReader;
    stagedReader: MediaSourceReader;
  }>;

export class RoutingMediaSourceReader
  implements MediaSourceReader
{
  public constructor(
    private readonly options:
      RoutingMediaSourceReaderOptions,
  ) {}

  public read(
    sourceUrl: string,
  ): Promise<MediaBinary> {
    let protocol: string;

    try {
      protocol =
        new URL(
          sourceUrl,
        ).protocol;
    } catch {
      throw new Error(
        `Invalid media source URL: ${sourceUrl}`,
      );
    }

    if (
      protocol === "http:" ||
      protocol === "https:"
    ) {
      return this.options
        .httpReader
        .read(sourceUrl);
    }

    if (
      protocol === "staging:"
    ) {
      return this.options
        .stagedReader
        .read(sourceUrl);
    }

    throw new Error(
      `Unsupported media source protocol: ${protocol}`,
    );
  }
}