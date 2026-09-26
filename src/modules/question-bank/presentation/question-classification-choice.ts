/**
 * A single <select> value identifying either a topic or a subtopic, so
 * the review form can classify at both levels without client-side JS.
 */
export type QuestionClassificationChoice =
  | Readonly<{ kind: "topic"; topicId: string }>
  | Readonly<{ kind: "subtopic"; subtopicId: string }>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeTopicChoice(topicId: string): string {
  return `topic:${topicId}`;
}

export function encodeSubtopicChoice(subtopicId: string): string {
  return `subtopic:${subtopicId}`;
}

export function parseQuestionClassificationChoice(
  value: unknown,
): QuestionClassificationChoice | null {
  if (typeof value !== "string") {
    return null;
  }

  const separator = value.indexOf(":");

  if (separator < 0) {
    return null;
  }

  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1).trim().toLowerCase();

  if (!UUID_PATTERN.test(id)) {
    return null;
  }

  if (kind === "topic") {
    return { kind, topicId: id };
  }

  if (kind === "subtopic") {
    return { kind, subtopicId: id };
  }

  return null;
}
