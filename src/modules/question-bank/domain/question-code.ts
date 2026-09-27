/*
 * Short public code of a question: "Q" + its sequential public number
 * (e.g. Q100001). Used in URLs, cards, search and support; the UUID
 * stays the internal identity and old UUID links keep working.
 */

const CODE_PATTERN = /^q?(\d{5,9})$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function formatQuestionCode(publicNumber: number): string {
  return `Q${publicNumber}`;
}

/** Public number from "Q100001", "q100001" or "100001"; null otherwise. */
export function parseQuestionCode(value: string): number | null {
  const match = value.trim().match(CODE_PATTERN);
  return match ? Number(match[1]) : null;
}

export type QuestionReference =
  | Readonly<{ kind: "code"; publicNumber: number }>
  | Readonly<{ kind: "id"; id: string }>
  | Readonly<{ kind: "invalid" }>;

/** Accepts a public code or an internal UUID (links created before codes). */
export function parseQuestionReference(value: string): QuestionReference {
  const publicNumber = parseQuestionCode(value);

  if (publicNumber !== null) {
    return { kind: "code", publicNumber };
  }

  const trimmed = value.trim();

  return UUID_PATTERN.test(trimmed) ? { kind: "id", id: trimmed.toLowerCase() } : { kind: "invalid" };
}
