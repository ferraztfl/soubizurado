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
      "resolves a content-addressed file inside its bucket",
      () => {
        const root =
          resolve(
            "data-private/media-store",
          );

        expect(
          resolveLocalPublicMediaPath({
            rootDirectory:
              root,
            bucket:
              "question-media",
            storageKey:
              "sha256/aa/bb/file.png",
          }),
        ).toBe(
          resolve(
            root,
            "question-media",
            "sha256/aa/bb/file.png",
          ),
        );
      },
    );

    it(
      "rejects a bucket escaping the storage root",
      () => {
        expect(() =>
          resolveLocalPublicMediaPath({
            rootDirectory:
              "data-private/media-store",
            bucket:
              "../outside",
            storageKey:
              "file.png",
          }),
        ).toThrow(
          "Media bucket escapes storage root.",
        );
      },
    );

    it(
      "rejects a storage key escaping its bucket",
      () => {
        expect(() =>
          resolveLocalPublicMediaPath({
            rootDirectory:
              "data-private/media-store",
            bucket:
              "question-media",
            storageKey:
              "../../secret.txt",
          }),
        ).toThrow(
          "Media storage key escapes bucket.",
        );
      },
    );
  },
);