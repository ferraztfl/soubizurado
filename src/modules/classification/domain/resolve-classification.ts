import { normalizeTaxonomyTerm } from "@/modules/taxonomy/domain/taxonomy-term";

import type {
  ProviderClassification,
  QuestionClassificationInput,
} from "./question-classifier";
import type {
  IndexedDiscipline,
  IndexedTopic,
  TaxonomyIndex,
} from "./taxonomy-index";

export type ClassificationIssueCode =
  | "DISCIPLINE_OUT_OF_SCOPE"
  | "DISCIPLINE_UNDETERMINED"
  | "TOPIC_MISSING"
  | "TOPIC_UNKNOWN"
  | "TOPIC_AMBIGUOUS"
  | "AREA_MISMATCH"
  | "SUBTOPIC_UNKNOWN";

export type ClassificationIssue = Readonly<{
  code: ClassificationIssueCode;
  value?: string;
}>;

/** Issues that only lose precision; the topic suggestion still holds. */
const NON_BLOCKING_ISSUES: ReadonlySet<ClassificationIssueCode> = new Set([
  "AREA_MISMATCH",
  "SUBTOPIC_UNKNOWN",
]);

export type ResolvedClassification = Readonly<{
  disciplineId: string | null;
  areaId: string | null;
  topicId: string | null;
  subtopicId: string | null;
  tags: readonly string[];
  confidence: number;
  issues: readonly ClassificationIssue[];
}>;

const MAX_TAGS = 8;
const MAX_TAG_LENGTH = 120;

function clampConfidence(value: number): number {
  return Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : 0;
}

function matches(
  terms: readonly string[],
  value: string | null,
): boolean {
  if (!value) {
    return false;
  }

  const normalized = normalizeTaxonomyTerm(value);

  return normalized.length > 0 && terms.includes(normalized);
}

function findTopics(
  disciplines: readonly IndexedDiscipline[],
  name: string,
): Readonly<{ discipline: IndexedDiscipline; topic: IndexedTopic }>[] {
  return disciplines.flatMap((discipline) =>
    discipline.topics
      .filter((topic) => matches(topic.terms, name))
      .map((topic) => ({ discipline, topic })),
  );
}

/**
 * Maps provider names to canonical ids inside the allowed candidates.
 * Unknown or out-of-scope names are dropped and reported; nothing is
 * ever created.
 */
export function resolveProviderClassification(
  index: TaxonomyIndex,
  input: Pick<QuestionClassificationInput, "disciplineId" | "knowledgeAreaId">,
  result: ProviderClassification,
): ResolvedClassification {
  const issues: ClassificationIssue[] = [];
  const candidates = index.candidateDisciplines(input);

  const tags = [
    ...new Set(
      result.tags
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0 && tag.length <= MAX_TAG_LENGTH),
    ),
  ].slice(0, MAX_TAGS);

  let discipline: IndexedDiscipline | undefined =
    candidates.length === 1 ? candidates[0] : undefined;

  if (result.discipline) {
    const named = candidates.find((candidate) =>
      matches(candidate.terms, result.discipline),
    );

    if (named) {
      discipline = named;
    } else {
      issues.push({ code: "DISCIPLINE_OUT_OF_SCOPE", value: result.discipline });
    }
  }

  let topic: IndexedTopic | undefined;

  if (result.topic) {
    const hits = findTopics(discipline ? [discipline] : candidates, result.topic);

    if (hits.length === 1) {
      topic = hits[0]!.topic;
      discipline = hits[0]!.discipline;
    } else {
      issues.push({
        code: hits.length > 1 ? "TOPIC_AMBIGUOUS" : "TOPIC_UNKNOWN",
        value: result.topic,
      });
    }
  } else {
    issues.push({ code: "TOPIC_MISSING" });
  }

  if (!discipline) {
    issues.push({ code: "DISCIPLINE_UNDETERMINED" });
  }

  if (
    topic?.areaName &&
    result.area &&
    normalizeTaxonomyTerm(result.area) !== normalizeTaxonomyTerm(topic.areaName)
  ) {
    issues.push({ code: "AREA_MISMATCH", value: result.area });
  }

  let subtopicId: string | null = null;

  if (topic && result.subtopic) {
    const subtopic = topic.subtopics.find((candidate) =>
      matches(candidate.terms, result.subtopic),
    );

    if (subtopic) {
      subtopicId = subtopic.id;
    } else {
      issues.push({ code: "SUBTOPIC_UNKNOWN", value: result.subtopic });
    }
  }

  return {
    disciplineId: discipline?.id ?? null,
    // The area always comes from the resolved topic, never the provider.
    areaId: topic?.areaId ?? null,
    topicId: topic?.id ?? null,
    subtopicId,
    tags,
    confidence: clampConfidence(result.confidence),
    issues,
  };
}

/**
 * Suggestions are never auto-applied. COMPLETED only marks a complete,
 * consistent, confident suggestion; everything else needs a closer
 * human look. The threshold must be calibrated on reviewed data.
 */
export function decideClassificationStatus(
  resolved: ResolvedClassification,
  minimumConfidence: number,
): "COMPLETED" | "REVIEW_REQUIRED" {
  const blocking = resolved.issues.some(
    (issue) => !NON_BLOCKING_ISSUES.has(issue.code),
  );

  return resolved.topicId &&
    resolved.disciplineId &&
    !blocking &&
    resolved.confidence >= minimumConfidence
    ? "COMPLETED"
    : "REVIEW_REQUIRED";
}
