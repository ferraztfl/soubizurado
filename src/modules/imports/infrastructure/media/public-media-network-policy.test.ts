import {
  describe,
  expect,
  it,
} from "vitest";

import {
  resolvePublicMediaAddress,
  type MediaHostResolver,
} from "./public-media-network-policy";

describe(
  "public media network policy",
  () => {
    it(
      "accepts a public IPv4 address",
      async () => {
        await expect(
          resolvePublicMediaAddress(
            "8.8.8.8",
          ),
        ).resolves.toEqual({
          address:
            "8.8.8.8",
          family: 4,
        });
      },
    );

    it.each([
      "127.0.0.1",
      "10.0.0.1",
      "169.254.169.254",
      "192.168.1.1",
      "::1",
      "fc00::1",
      "fe80::1",
    ])(
      "blocks private or reserved address %s",
      async (
        address,
      ) => {
        await expect(
          resolvePublicMediaAddress(
            address,
          ),
        ).rejects.toThrow(
          "Blocked private or reserved media address",
        );
      },
    );

    it(
      "accepts a hostname resolving only to public addresses",
      async () => {
        const resolver:
          MediaHostResolver =
          async () => [
            {
              address:
                "8.8.8.8",
              family: 4,
            },
            {
              address:
                "1.1.1.1",
              family: 4,
            },
          ];

        await expect(
          resolvePublicMediaAddress(
            "media.example.test",
            resolver,
          ),
        ).resolves.toEqual({
          address:
            "8.8.8.8",
          family: 4,
        });
      },
    );

    it(
      "rejects a hostname when any resolved address is private",
      async () => {
        const resolver:
          MediaHostResolver =
          async () => [
            {
              address:
                "8.8.8.8",
              family: 4,
            },
            {
              address:
                "10.0.0.10",
              family: 4,
            },
          ];

        await expect(
          resolvePublicMediaAddress(
            "mixed.example.test",
            resolver,
          ),
        ).rejects.toThrow(
          "Blocked private or reserved media address",
        );
      },
    );
  },
);
