import {
  normalizeTaxonomyTerm,
  toTaxonomySlug,
} from "./taxonomy-term";

export type CatalogNode = Readonly<{
  name: string;
  aliases?: readonly string[];
  description?: string;
}>;

export type CatalogSubtopic = CatalogNode;

export type CatalogTopic = CatalogNode &
  Readonly<{
    subtopics?: readonly CatalogSubtopic[];
  }>;

/** "Assunto" in the UI; stored as Area. */
export type CatalogArea = CatalogNode &
  Readonly<{
    topics: readonly CatalogTopic[];
  }>;

export type CatalogDiscipline = CatalogNode &
  Readonly<{
    knowledgeAreaSlug: string | null;
    areas: readonly CatalogArea[];
  }>;

export type CatalogKnowledgeArea = CatalogNode &
  Readonly<{
    slug: string;
  }>;

export type CanonicalTaxonomyCatalog = Readonly<{
  version: number;
  summary: string;
  knowledgeAreas: readonly CatalogKnowledgeArea[];
  disciplines: readonly CatalogDiscipline[];
}>;

const SLUG_MAX_LENGTH = {
  knowledgeArea: 180,
  discipline: 180,
  area: 180,
  topic: 200,
  subtopic: 200,
} as const;

const ALIAS_MAX_LENGTH = 200;

/**
 * Names and aliases that must not collide within one scope, keyed by
 * normalized term. Mirrors the database unique constraints.
 */
class TermScope {
  private readonly owners =
    new Map<string, string>();

  public constructor(
    private readonly label: string,
    private readonly issues: string[],
  ) {}

  public claim(
    term: string,
    owner: string,
  ): void {
    const normalized =
      normalizeTaxonomyTerm(term);

    if (!normalized) {
      this.issues.push(
        `${this.label}: "${term}" (${owner}) is empty after normalization.`,
      );
      return;
    }

    if (normalized.length > ALIAS_MAX_LENGTH) {
      this.issues.push(
        `${this.label}: "${term}" (${owner}) exceeds ${ALIAS_MAX_LENGTH} characters.`,
      );
    }

    const existing =
      this.owners.get(normalized);

    if (existing && existing !== owner) {
      this.issues.push(
        `${this.label}: "${term}" is used by both ${existing} and ${owner}.`,
      );
      return;
    }

    this.owners.set(normalized, owner);
  }
}

function claimNode(
  scope: TermScope,
  node: CatalogNode,
  owner: string,
): void {
  scope.claim(node.name, owner);

  for (const alias of node.aliases ?? []) {
    scope.claim(alias, owner);
  }
}

function checkSlug(
  issues: string[],
  name: string,
  maxLength: number,
  owner: string,
): void {
  const slug = toTaxonomySlug(name);

  if (!slug) {
    issues.push(`${owner} has an empty slug.`);
  } else if (slug.length > maxLength) {
    issues.push(
      `${owner} slug exceeds ${maxLength} characters.`,
    );
  }
}

/**
 * Returns every structural problem in the catalog. An empty array means
 * it can be written without violating uniqueness or introducing
 * semantic duplicates (same normalized term twice in one scope).
 */
export function validateCanonicalTaxonomyCatalog(
  catalog: CanonicalTaxonomyCatalog,
): string[] {
  const issues: string[] = [];

  if (
    !Number.isSafeInteger(catalog.version) ||
    catalog.version < 1
  ) {
    issues.push("Catalog version must be a positive integer.");
  }

  const knowledgeAreaSlugs = new Set<string>();

  for (const knowledgeArea of catalog.knowledgeAreas) {
    const owner = `knowledge area "${knowledgeArea.name}"`;

    if (knowledgeArea.slug !== toTaxonomySlug(knowledgeArea.slug)) {
      issues.push(`${owner} slug is not normalized.`);
    }

    if (knowledgeArea.slug.length > SLUG_MAX_LENGTH.knowledgeArea) {
      issues.push(`${owner} slug is too long.`);
    }

    if (knowledgeAreaSlugs.has(knowledgeArea.slug)) {
      issues.push(`${owner} slug is duplicated.`);
    }

    knowledgeAreaSlugs.add(knowledgeArea.slug);
  }

  const disciplineScope = new TermScope(
    "disciplines",
    issues,
  );

  for (const discipline of catalog.disciplines) {
    const disciplineOwner = `discipline "${discipline.name}"`;

    checkSlug(
      issues,
      discipline.name,
      SLUG_MAX_LENGTH.discipline,
      disciplineOwner,
    );
    claimNode(disciplineScope, discipline, disciplineOwner);

    if (
      discipline.knowledgeAreaSlug !== null &&
      !knowledgeAreaSlugs.has(discipline.knowledgeAreaSlug)
    ) {
      issues.push(
        `${disciplineOwner} references unknown knowledge area "${discipline.knowledgeAreaSlug}".`,
      );
    }

    if (discipline.areas.length === 0) {
      issues.push(`${disciplineOwner} has no areas.`);
    }

    // Topics are unique per discipline (not per area) in the database.
    const areaScope = new TermScope(
      `areas of ${discipline.name}`,
      issues,
    );
    const topicScope = new TermScope(
      `topics of ${discipline.name}`,
      issues,
    );

    for (const area of discipline.areas) {
      const areaOwner = `area "${area.name}"`;

      checkSlug(issues, area.name, SLUG_MAX_LENGTH.area, areaOwner);
      claimNode(areaScope, area, areaOwner);

      if (area.topics.length === 0) {
        issues.push(
          `${areaOwner} of ${discipline.name} has no topics.`,
        );
      }

      for (const topic of area.topics) {
        const topicOwner = `topic "${topic.name}"`;

        checkSlug(issues, topic.name, SLUG_MAX_LENGTH.topic, topicOwner);
        claimNode(topicScope, topic, topicOwner);

        const subtopicScope = new TermScope(
          `subtopics of ${discipline.name} / ${topic.name}`,
          issues,
        );

        for (const subtopic of topic.subtopics ?? []) {
          const subtopicOwner = `subtopic "${subtopic.name}"`;

          checkSlug(
            issues,
            subtopic.name,
            SLUG_MAX_LENGTH.subtopic,
            subtopicOwner,
          );
          claimNode(subtopicScope, subtopic, subtopicOwner);
        }
      }
    }
  }

  return issues;
}

export type CatalogCounts = Readonly<{
  knowledgeAreas: number;
  disciplines: number;
  areas: number;
  topics: number;
  subtopics: number;
  aliases: number;
}>;

export function countCatalog(
  catalog: CanonicalTaxonomyCatalog,
): CatalogCounts {
  let areas = 0;
  let topics = 0;
  let subtopics = 0;
  let aliases = 0;

  for (const discipline of catalog.disciplines) {
    aliases += discipline.aliases?.length ?? 0;

    for (const area of discipline.areas) {
      areas += 1;
      aliases += area.aliases?.length ?? 0;

      for (const topic of area.topics) {
        topics += 1;
        aliases += topic.aliases?.length ?? 0;

        for (const subtopic of topic.subtopics ?? []) {
          subtopics += 1;
          aliases += subtopic.aliases?.length ?? 0;
        }
      }
    }
  }

  return {
    knowledgeAreas: catalog.knowledgeAreas.length,
    disciplines: catalog.disciplines.length,
    areas,
    topics,
    subtopics,
    aliases,
  };
}
