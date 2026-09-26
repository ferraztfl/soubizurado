import {
  createHash,
} from "node:crypto";

export type MediaFingerprintIdentityInput =
  Readonly<{
    role: string;
    alternativeLabel: string | null;
    sourceUrl: string;
  }>;

const STAGED_CONTENT_HASH =
  /^staging:\/\/local\/.+\/([a-f0-9]{64})(?:\.[a-z0-9]+)?$/i;

function sha256(
  value: string,
): string {
  return createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

export function extractMediaContentHash(
  sourceUrl: string,
): string | null {
  const match =
    sourceUrl
      .trim()
      .match(STAGED_CONTENT_HASH);

  return match?.[1]?.toLowerCase() ?? null;
}

export function buildMediaFingerprintIdentity(
  input: MediaFingerprintIdentityInput,
): string {
  const contentHash =
    extractMediaContentHash(
      input.sourceUrl,
    );

  const mediaIdentity =
    contentHash
      ? `sha256:${contentHash}`
      : `locator:${input.sourceUrl.trim()}`;

  return sha256(
    [
      input.role,
      input.alternativeLabel ?? "",
      mediaIdentity,
    ].join("\u0000"),
  );
}
