import { createHash } from "node:crypto";

export const QUESTION_NORMALIZATION_VERSION = 1;

export type FingerprintQuestionType =
  | "MULTIPLE_CHOICE"
  | "TRUE_FALSE";

export type QuestionFingerprintInput = Readonly<{
  type: FingerprintQuestionType;
  supportTexts: readonly string[];
  statement: string;
  alternatives: readonly Readonly<{
    label: string;
    content: string;
  }>[];
  mediaHashes: readonly string[];
}>;

const NAMED_ENTITIES: Readonly<
  Record<string, string>
> = {
  nbsp: " ",
  amp: "&",
  quot: """,
  apos: "'",
  lt: "<",
  gt: ">",
};

function decodeHtmlEntities(
  value: string,
): string {
  return value.replace(
    /&(#x?[0-9a-f]+|[a-z]+);/gi,
    (match, entity: string) => {
      const normalized =
        entity.toLowerCase();

      if (normalized.startsWith("#x")) {
        const codePoint = Number.parseInt(
          normalized.slice(2),
          16,
        );

        return Number.isFinite(codePoint)
          ? String.fromCodePoint(codePoint)
          : match;
      }

      if (normalized.startsWith("#")) {
        const codePoint = Number.parseInt(
          normalized.slice(1),
          10,
        );

        return Number.isFinite(codePoint)
          ? String.fromCodePoint(codePoint)
          : match;
      }

      return NAMED_ENTITIES[normalized] ?? match;
    },
  );
}

export function questionHtmlToPlainText(
  value: string,
): string {
  return decodeHtmlEntities(
    value
      .replace(
        /<(script|style)[^>]*>[\s\S]*?<\/\1>/gi,
        " ",
      )
      .replace(/<[^>]+>/g, " "),
  )
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeQuestionText(
  value: string,
): string {
  return questionHtmlToPlainText(value)
    .toLocaleLowerCase("pt-BR");
}

export function buildCanonicalQuestionFingerprint(
  input: QuestionFingerprintInput,
): string {
  const payload = {
    version: QUESTION_NORMALIZATION_VERSION,
    type: input.type,
    supportTexts: input.supportTexts.map(
      normalizeQuestionText,
    ),
    statement: normalizeQuestionText(
      input.statement,
    ),
    alternatives: [...input.alternatives]
      .map((alternative) => ({
        label: normalizeQuestionText(
          alternative.label,
        ),
        content: normalizeQuestionText(
          alternative.content,
        ),
      }))
      .sort((first, second) =>
        first.label.localeCompare(
          second.label,
          "pt-BR",
        ),
      ),
    mediaHashes: [...input.mediaHashes]
      .map((hash) =>
        hash.trim().toLowerCase(),
      )
      .sort(),
  };

  return createHash("sha256")
    .update(JSON.stringify(payload), "utf8")
    .digest("hex");
}
