import {
  resolve,
} from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  resolveLocalPublicMediaPath,
} from "./local-public-media";

describe(
  "resolveLocalPublicMediaPath",
  () => {
    it(
      "resolves the storage key directly below the storage root",
      () => {
        const root =
          resolve(
            "data-private/media-store",
          );

        expect(
          resolveLocalPublicMediaPath({
            rootDirectory:
              root,
            storageKey:
              "sha256/aa/bb/file.png",
          }),
        ).toBe(
          resolve(
            root,
            "sha256/aa/bb/file.png",
          ),
        );
      },
    );

    it(
      "rejects a storage key escaping the storage root",
      () => {
        expect(() =>
          resolveLocalPublicMediaPath({
            rootDirectory:
              "data-private/media-store",
            storageKey:
              "../../secret.txt",
          }),
        ).toThrow(
          "Media storage key escapes storage root.",
        );
      },
    );

    it(
      "rejects an empty storage key",
      () => {
        expect(() =>
          resolveLocalPublicMediaPath({
            rootDirectory:
              "data-private/media-store",
            storageKey:
              "   ",
          }),
        ).toThrow(
          "Invalid local media storage key.",
        );
      },
    );
  },
);