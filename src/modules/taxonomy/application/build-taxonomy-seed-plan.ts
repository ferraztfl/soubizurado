import type {
  CanonicalTaxonomyCatalog,
  CatalogNode,
} from "../domain/canonical-taxonomy-catalog";
import {
  normalizeTaxonomyTerm,
  toTaxonomySlug,
} from "../domain/taxonomy-term";

/** Existing taxonomy rows, loaded once before planning. */
export type TaxonomySnapshot = Readonly<{
  knowledgeAreas: readonly Readonly<{ id: string; slug: string }>[];
  disciplines: readonly Readonly<{
    id: string;
    slug: string;
    knowledgeAreaId: string | null;
  }>[];
  areas: readonly Readonly<{ id: string; disciplineId: string; slug: string }>[];
  topics: readonly Readonly<{
    id: string;
    disciplineId: string;
    areaId: string | null;
    slug: string;
  }>[];
  subtopics: readonly Readonly<{ id: string; topicId: string; slug: string }>[];
  disciplineAliases: readonly Readonly<{ disciplineId: string; normalizedName: string }>[];
  areaAliases: readonly Readonly<{ areaId: string; disciplineId: string; normalizedName: string }>[];
  topicAliases: readonly Readonly<{ topicId: string; disciplineId: string; normalizedName: string }>[];
  subtopicAliases: readonly Readonly<{ subtopicId: string; topicId: string; normalizedName: string }>[];
  revisionVersions: readonly number[];
}>;

type NodeRow = Readonly<{
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
}>;

type AliasRow = Readonly<{
  id: string;
  name: string;
  normalizedName: string;
}>;

export type TaxonomySeedPlan = Readonly<{
  knowledgeAreas: readonly NodeRow[];
  disciplines: readonly (NodeRow & { knowledgeAreaId: string | null })[];
  /** Existing disciplines whose missing knowledge area gets filled. */
  disciplineKnowledgeAreaLinks: readonly Readonly<{
    disciplineId: string;
    knowledgeAreaId: string;
  }>[];
  areas: readonly (NodeRow & { disciplineId: string })[];
  topics: readonly (NodeRow & { disciplineId: string; areaId: string })[];
  subtopics: readonly (NodeRow & { topicId: string })[];
  disciplineAliases: readonly (AliasRow & { disciplineId: string })[];
  areaAliases: readonly (AliasRow & { areaId: string; disciplineId: string })[];
  topicAliases: readonly (AliasRow & { topicId: string; disciplineId: string })[];
  subtopicAliases: readonly (AliasRow & { subtopicId: string; topicId: string })[];
  revision: Readonly<{ id: string; version: number; summary: string }> | null;
  /** Anything that prevents a safe apply. */
  conflicts: readonly string[];
}>;

export type SeedPlanCounts = Readonly<Record<
  Exclude<keyof TaxonomySeedPlan, "revision" | "conflicts">,
  number
>>;

export function countSeedPlan(
  plan: TaxonomySeedPlan,
): SeedPlanCounts {
  return {
    knowledgeAreas: plan.knowledgeAreas.length,
    disciplines: plan.disciplines.length,
    disciplineKnowledgeAreaLinks: plan.disciplineKnowledgeAreaLinks.length,
    areas: plan.areas.length,
    topics: plan.topics.length,
    subtopics: plan.subtopics.length,
    disciplineAliases: plan.disciplineAliases.length,
    areaAliases: plan.areaAliases.length,
    topicAliases: plan.topicAliases.length,
    subtopicAliases: plan.subtopicAliases.length,
  };
}

function key(...parts: readonly string[]): string {
  return parts.join("\u0000");
}

/**
 * Canonical names and aliases in one uniqueness scope. A term is owned
 * by exactly one entity id; claiming it for another id is a conflict.
 */
class ScopeTerms {
  private readonly owners = new Map<string, string>();

  public own(term: string, entityId: string): void {
    this.owners.set(term, entityId);
  }

  public ownerOf(term: string): string | undefined {
    return this.owners.get(term);
  }
}

/**
 * Computes the create-only changes needed to bring the database up to
 * the catalog. Existing rows are never renamed, reactivated, moved or
 * deleted; mismatches are reported as conflicts instead.
 */
export function buildTaxonomySeedPlan(
  catalog: CanonicalTaxonomyCatalog,
  snapshot: TaxonomySnapshot,
  newId: () => string,
): TaxonomySeedPlan {
  const conflicts: string[] = [];

  const knowledgeAreas: NodeRow[] = [];
  const disciplines: (NodeRow & { knowledgeAreaId: string | null })[] = [];
  const disciplineKnowledgeAreaLinks: {
    disciplineId: string;
    knowledgeAreaId: string;
  }[] = [];
  const areas: (NodeRow & { disciplineId: string })[] = [];
  const topics: (NodeRow & { disciplineId: string; areaId: string })[] = [];
  const subtopics: (NodeRow & { topicId: string })[] = [];
  const disciplineAliases: (AliasRow & { disciplineId: string })[] = [];
  const areaAliases: (AliasRow & { areaId: string; disciplineId: string })[] = [];
  const topicAliases: (AliasRow & { topicId: string; disciplineId: string })[] = [];
  const subtopicAliases: (AliasRow & { subtopicId: string; topicId: string })[] = [];

  // --- index snapshot -------------------------------------------------
  const knowledgeAreaBySlug = new Map(
    snapshot.knowledgeAreas.map((row) => [row.slug, row]),
  );
  const disciplineBySlug = new Map(
    snapshot.disciplines.map((row) => [row.slug, row]),
  );
  const areaByKey = new Map(
    snapshot.areas.map((row) => [key(row.disciplineId, row.slug), row]),
  );
  const topicByKey = new Map(
    snapshot.topics.map((row) => [key(row.disciplineId, row.slug), row]),
  );
  const subtopicByKey = new Map(
    snapshot.subtopics.map((row) => [key(row.topicId, row.slug), row]),
  );

  const disciplineTerms = new ScopeTerms();
  const areaTerms = new Map<string, ScopeTerms>();
  const topicTerms = new Map<string, ScopeTerms>();
  const subtopicTerms = new Map<string, ScopeTerms>();

  function scopeFor(
    scopes: Map<string, ScopeTerms>,
    scopeId: string,
  ): ScopeTerms {
    let scope = scopes.get(scopeId);

    if (!scope) {
      scope = new ScopeTerms();
      scopes.set(scopeId, scope);
    }

    return scope;
  }

  // Slugs are normalized terms joined by "-"; compare in term space.
  const slugTerm = (slug: string) => slug.replace(/-/g, " ");

  for (const row of snapshot.disciplines) {
    disciplineTerms.own(slugTerm(row.slug), row.id);
  }
  for (const row of snapshot.disciplineAliases) {
    disciplineTerms.own(row.normalizedName, row.disciplineId);
  }
  for (const row of snapshot.areas) {
    scopeFor(areaTerms, row.disciplineId).own(slugTerm(row.slug), row.id);
  }
  for (const row of snapshot.areaAliases) {
    scopeFor(areaTerms, row.disciplineId).own(row.normalizedName, row.areaId);
  }
  for (const row of snapshot.topics) {
    scopeFor(topicTerms, row.disciplineId).own(slugTerm(row.slug), row.id);
  }
  for (const row of snapshot.topicAliases) {
    scopeFor(topicTerms, row.disciplineId).own(row.normalizedName, row.topicId);
  }
  for (const row of snapshot.subtopics) {
    scopeFor(subtopicTerms, row.topicId).own(slugTerm(row.slug), row.id);
  }
  for (const row of snapshot.subtopicAliases) {
    scopeFor(subtopicTerms, row.topicId).own(row.normalizedName, row.subtopicId);
  }

  function nodeRow(
    node: CatalogNode,
    id: string,
    sortOrder: number,
  ): NodeRow {
    return {
      id,
      name: node.name,
      slug: toTaxonomySlug(node.name),
      description: node.description ?? null,
      sortOrder,
    };
  }

  /** Claims canonical name + aliases; returns aliases to create. */
  function claimTerms(
    scope: ScopeTerms,
    node: CatalogNode,
    entityId: string,
    label: string,
  ): AliasRow[] {
    const canonical = normalizeTaxonomyTerm(node.name);
    const canonicalOwner = scope.ownerOf(canonical);

    if (canonicalOwner && canonicalOwner !== entityId) {
      conflicts.push(
        `${label}: name "${node.name}" is already an alias of another entry.`,
      );
    } else {
      scope.own(canonical, entityId);
    }

    const created: AliasRow[] = [];

    for (const alias of node.aliases ?? []) {
      const normalizedName = normalizeTaxonomyTerm(alias);
      const owner = scope.ownerOf(normalizedName);

      if (owner === entityId) {
        continue;
      }

      if (owner) {
        conflicts.push(
          `${label}: alias "${alias}" already belongs to another entry.`,
        );
        continue;
      }

      scope.own(normalizedName, entityId);
      created.push({ id: newId(), name: alias, normalizedName });
    }

    return created;
  }

  // --- knowledge areas ------------------------------------------------
  const knowledgeAreaIdBySlug = new Map<string, string>();

  catalog.knowledgeAreas.forEach((knowledgeArea, index) => {
    const existing = knowledgeAreaBySlug.get(knowledgeArea.slug);

    if (existing) {
      knowledgeAreaIdBySlug.set(knowledgeArea.slug, existing.id);
      return;
    }

    const row = {
      ...nodeRow(knowledgeArea, newId(), (index + 1) * 10),
      slug: knowledgeArea.slug,
    };

    knowledgeAreas.push(row);
    knowledgeAreaIdBySlug.set(knowledgeArea.slug, row.id);
  });

  // --- disciplines and below -----------------------------------------
  catalog.disciplines.forEach((discipline, disciplineIndex) => {
    const disciplineLabel = `Disciplina "${discipline.name}"`;
    const slug = toTaxonomySlug(discipline.name);
    const knowledgeAreaId = discipline.knowledgeAreaSlug
      ? knowledgeAreaIdBySlug.get(discipline.knowledgeAreaSlug) ?? null
      : null;

    let disciplineId: string;
    const existingDiscipline = disciplineBySlug.get(slug);

    if (existingDiscipline) {
      disciplineId = existingDiscipline.id;

      if (knowledgeAreaId) {
        if (existingDiscipline.knowledgeAreaId === null) {
          disciplineKnowledgeAreaLinks.push({ disciplineId, knowledgeAreaId });
        } else if (existingDiscipline.knowledgeAreaId !== knowledgeAreaId) {
          conflicts.push(
            `${disciplineLabel}: already linked to a different knowledge area.`,
          );
        }
      }
    } else {
      disciplineId = newId();
      disciplines.push({
        ...nodeRow(discipline, disciplineId, (disciplineIndex + 1) * 10),
        knowledgeAreaId,
      });
    }

    for (const alias of claimTerms(
      disciplineTerms,
      discipline,
      disciplineId,
      disciplineLabel,
    )) {
      disciplineAliases.push({ ...alias, disciplineId });
    }

    const disciplineAreaTerms = scopeFor(areaTerms, disciplineId);
    const disciplineTopicTerms = scopeFor(topicTerms, disciplineId);

    discipline.areas.forEach((area, areaIndex) => {
      const areaLabel = `${disciplineLabel} / assunto "${area.name}"`;
      const areaSlug = toTaxonomySlug(area.name);
      const existingArea = areaByKey.get(key(disciplineId, areaSlug));
      const areaId = existingArea?.id ?? newId();

      if (!existingArea) {
        areas.push({
          ...nodeRow(area, areaId, (areaIndex + 1) * 10),
          disciplineId,
        });
      }

      for (const alias of claimTerms(
        disciplineAreaTerms,
        area,
        areaId,
        areaLabel,
      )) {
        areaAliases.push({ ...alias, areaId, disciplineId });
      }

      area.topics.forEach((topic, topicIndex) => {
        const topicLabel = `${areaLabel} / tópico "${topic.name}"`;
        const topicSlug = toTaxonomySlug(topic.name);
        const existingTopic = topicByKey.get(key(disciplineId, topicSlug));
        const topicId = existingTopic?.id ?? newId();

        if (existingTopic) {
          if (existingTopic.areaId !== areaId) {
            conflicts.push(
              `${topicLabel}: already exists under a different assunto.`,
            );
          }
        } else {
          topics.push({
            ...nodeRow(topic, topicId, (topicIndex + 1) * 10),
            disciplineId,
            areaId,
          });
        }

        for (const alias of claimTerms(
          disciplineTopicTerms,
          topic,
          topicId,
          topicLabel,
        )) {
          topicAliases.push({ ...alias, topicId, disciplineId });
        }

        const topicSubtopicTerms = scopeFor(subtopicTerms, topicId);

        (topic.subtopics ?? []).forEach((subtopic, subtopicIndex) => {
          const subtopicLabel = `${topicLabel} / subtópico "${subtopic.name}"`;
          const subtopicSlug = toTaxonomySlug(subtopic.name);
          const existingSubtopic = subtopicByKey.get(key(topicId, subtopicSlug));
          const subtopicId = existingSubtopic?.id ?? newId();

          if (!existingSubtopic) {
            subtopics.push({
              ...nodeRow(subtopic, subtopicId, (subtopicIndex + 1) * 10),
              topicId,
            });
          }

          for (const alias of claimTerms(
            topicSubtopicTerms,
            subtopic,
            subtopicId,
            subtopicLabel,
          )) {
            subtopicAliases.push({ ...alias, subtopicId, topicId });
          }
        });
      });
    });
  });

  const maxVersion = Math.max(0, ...snapshot.revisionVersions);
  let revision: TaxonomySeedPlan["revision"] = null;

  if (catalog.version > maxVersion) {
    revision = {
      id: newId(),
      version: catalog.version,
      summary: catalog.summary,
    };
  } else if (!snapshot.revisionVersions.includes(catalog.version)) {
    conflicts.push(
      `Catalog version ${catalog.version} is older than the recorded taxonomy version ${maxVersion}.`,
    );
  }

  return {
    knowledgeAreas,
    disciplines,
    disciplineKnowledgeAreaLinks,
    areas,
    topics,
    subtopics,
    disciplineAliases,
    areaAliases,
    topicAliases,
    subtopicAliases,
    revision,
    conflicts,
  };
}
