import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  HttpMediaSourceReader,
} from "./http-media-source-reader";
import type {
  MediaHostResolver,
} from "./public-media-network-policy";

describe(
  "HttpMediaSourceReader SSRF protection",
  () => {
    it(
      "blocks a hostname resolving to a private address before connecting",
      async () => {
        const resolver:
          MediaHostResolver =
          vi.fn(
            async () => [
              {
                address:
                  "127.0.0.1",
                family: 4 as const,
              },
            ],
          );

        const reader =
          new HttpMediaSourceReader({
            resolver,
            timeoutMs:
              1_000,
          });

        await expect(
          reader.read(
            "https://media.example.test/image.png",
          ),
        ).rejects.toThrow(
          "Blocked private or reserved media address",
        );

        expect(
          resolver,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    it(
      "blocks cloud metadata addresses without performing DNS resolution",
      async () => {
        const resolver:
          MediaHostResolver =
          vi.fn(
            async () => [
              {
                address:
                  "8.8.8.8",
                family: 4 as const,
              },
            ],
          );

        const reader =
          new HttpMediaSourceReader({
            resolver,
            timeoutMs:
              1_000,
          });

        await expect(
          reader.read(
            "http://169.254.169.254/latest/meta-data",
          ),
        ).rejects.toThrow(
          "Blocked private or reserved media address",
        );

        expect(
          resolver,
        ).not.toHaveBeenCalled();
      },
    );
  },
);

