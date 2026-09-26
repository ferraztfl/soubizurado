import { normalizeTaxonomyTerm } from "@/modules/taxonomy/domain/taxonomy-term";

export type IndexedSubtopic = Readonly<{
  id: string;
  name: string;
  terms: readonly string[];
}>;

export type IndexedTopic = Readonly<{
  id: string;
  name: string;
  areaId: string | null;
  areaName: string | null;
  terms: readonly string[];
  subtopics: readonly IndexedSubtopic[];
}>;

export type IndexedDiscipline = Readonly<{
  id: string;
  name: string;
  slug: string;
  knowledgeAreaId: string | null;
  terms: readonly string[];
  topics: readonly IndexedTopic[];
}>;

export type TaxonomyIndexSource = Readonly<{
  version: number;
  disciplines: readonly Readonly<{
    id: string;
    name: string;
    slug: string;
    knowledgeAreaId: string | null;
    aliases: readonly string[];
  }>[];
  areas: readonly Readonly<{
    id: string;
    disciplineId: string;
    name: string;
    aliases: readonly string[];
  }>[];
  topics: readonly Readonly<{
    id: string;
    disciplineId: string;
    areaId: string | null;
    name: string;
    aliases: readonly string[];
  }>[];
  subtopics: readonly Readonly<{
    id: string;
    topicId: string;
    name: string;
    aliases: readonly string[];
  }>[];
}>;

function termsOf(
  name: string,
  aliases: readonly string[],
): string[] {
  return [
    ...new Set(
      [name, ...aliases]
        .map(normalizeTaxonomyTerm)
        .filter(Boolean),
    ),
  ];
}

/**
 * Read-only view of the ACTIVE canonical taxonomy used by classifiers
 * (candidates) and by the resolver (names -> ids). Only disciplines
 * linked to a knowledge area are canonical candidates.
 */
export class TaxonomyIndex {
  public readonly version: number;

  private readonly disciplines: readonly IndexedDiscipline[];
  private readonly disciplineById: ReadonlyMap<string, IndexedDiscipline>;

  public constructor(source: TaxonomyIndexSource) {
    this.version = source.version;

    const areaById = new Map(source.areas.map((area) => [area.id, area]));
    const subtopicsByTopic = new Map<string, IndexedSubtopic[]>();

    for (const subtopic of source.subtopics) {
      const list = subtopicsByTopic.get(subtopic.topicId) ?? [];
      list.push({
        id: subtopic.id,
        name: subtopic.name,
        terms: termsOf(subtopic.name, subtopic.aliases),
      });
      subtopicsByTopic.set(subtopic.topicId, list);
    }

    const topicsByDiscipline = new Map<string, IndexedTopic[]>();

    for (const topic of source.topics) {
      const area = topic.areaId ? areaById.get(topic.areaId) : undefined;

      // Topics under an inactive (missing) area are not candidates.
      if (topic.areaId && !area) {
        continue;
      }

      const list = topicsByDiscipline.get(topic.disciplineId) ?? [];
      list.push({
        id: topic.id,
        name: topic.name,
        areaId: topic.areaId,
        areaName: area?.name ?? null,
        terms: termsOf(topic.name, topic.aliases),
        subtopics: subtopicsByTopic.get(topic.id) ?? [],
      });
      topicsByDiscipline.set(topic.disciplineId, list);
    }

    this.disciplines = source.disciplines
      .filter((discipline) => discipline.knowledgeAreaId !== null)
      .map((discipline) => ({
        id: discipline.id,
        name: discipline.name,
        slug: discipline.slug,
        knowledgeAreaId: discipline.knowledgeAreaId,
        terms: termsOf(discipline.name, discipline.aliases),
        topics: topicsByDiscipline.get(discipline.id) ?? [],
      }));

    this.disciplineById = new Map(
      this.disciplines.map((discipline) => [discipline.id, discipline]),
    );
  }

  public discipline(id: string): IndexedDiscipline | undefined {
    return this.disciplineById.get(id);
  }

  /**
   * Disciplines a question may be classified into: its current
   * canonical discipline, otherwise every discipline of its knowledge
   * area, otherwise all canonical disciplines.
   */
  public candidateDisciplines(
    constraints: Readonly<{
      disciplineId: string | null;
      knowledgeAreaId: string | null;
    }>,
  ): readonly IndexedDiscipline[] {
    if (constraints.disciplineId) {
      const current = this.disciplineById.get(constraints.disciplineId);

      if (current) {
        return [current];
      }
    }

    if (constraints.knowledgeAreaId) {
      return this.disciplines.filter(
        (discipline) =>
          discipline.knowledgeAreaId === constraints.knowledgeAreaId,
      );
    }

    return this.disciplines;
  }
}
