import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildMediaFingerprintIdentity,
  extractMediaContentHash,
} from "./media-fingerprint-identity";

describe(
  "media fingerprint identity",
  () => {
    const assetHash =
      "5316f8739b1f4e29447b6d367a40a91f69fe4c5c3393d02f60a05f5d9b4b717e";

    it(
      "extracts the binary checksum from staged content-addressed media",
      () => {
        expect(
          extractMediaContentHash(
            `staging://local/enem-pdf/2024/document-a/${assetHash}.png`,
          ),
        ).toBe(assetHash);
      },
    );

    it(
      "ignores the document staging path when binary content is identical",
      () => {
        const first =
          buildMediaFingerprintIdentity({
            role:
              "QUESTION_ATTACHMENT",
            alternativeLabel:
              "",
            sourceUrl:
              `staging://local/enem-pdf/2024/document-a/${assetHash}.png`,
          });

        const second =
          buildMediaFingerprintIdentity({
            role:
              "QUESTION_ATTACHMENT",
            alternativeLabel:
              "",
            sourceUrl:
              `staging://local/enem-pdf/2025/document-b/${assetHash}.png`,
          });

        expect(first).toBe(second);
      },
    );

    it(
      "keeps media role and alternative label in the identity",
      () => {
        const question =
          buildMediaFingerprintIdentity({
            role:
              "QUESTION_ATTACHMENT",
            alternativeLabel:
              "",
            sourceUrl:
              `staging://local/enem-pdf/2024/document-a/${assetHash}.png`,
          });

        const alternative =
          buildMediaFingerprintIdentity({
            role:
              "ALTERNATIVE_IMAGE",
            alternativeLabel:
              "A",
            sourceUrl:
              `staging://local/enem-pdf/2024/document-a/${assetHash}.png`,
          });

        expect(question)
          .not
          .toBe(alternative);
      },
    );

    it(
      "preserves locator identity for legacy non-content-addressed sources",
      () => {
        expect(
          extractMediaContentHash(
            "https://example.com/media/question.png",
          ),
        ).toBeNull();

        const first =
          buildMediaFingerprintIdentity({
            role:
              "QUESTION_ATTACHMENT",
            alternativeLabel:
              "",
            sourceUrl:
              "https://example.com/media/a.png",
          });

        const second =
          buildMediaFingerprintIdentity({
            role:
              "QUESTION_ATTACHMENT",
            alternativeLabel:
              "",
            sourceUrl:
              "https://example.com/media/b.png",
          });

        expect(first)
          .not
          .toBe(second);
      },
    );
  },
);
