import type { CatalogArea, CatalogDiscipline, CatalogSubtopic, CatalogTopic } from "../../domain/canonical-taxonomy-catalog";

import { area, topic } from "./concursos-taxonomy-additions";

/*
 * v9: entries requested during the manual review of question
 * classifications. Unlike earlier versions, these go inside areas and topics
 * that already exist, so they are keyed by the names of their parents. Same
 * editing rules: names are stable, only additions (appended after the
 * existing entries), nothing is renamed or removed.
 */

/** Areas ("Tópico" in the UI) added to existing disciplines, keyed by discipline name. */
export const V9_AREAS_FOR_EXISTING: Readonly<Record<string, readonly CatalogArea[]>> = {
  "Direito Penal Militar": [
    area("Teoria do Crime", [
      topic(
        "Exclusão do Crime",
        ["Estado de necessidade", "Legítima defesa", "Estrito cumprimento do dever legal", "Exercício regular de direito"],
        ["Excludentes de ilicitude", "Exclusão de crime"],
      ),
    ]),
    area("Crimes Militares em Tempo de Guerra", [
      topic("Favorecimento ao Inimigo", ["Traição", "Covardia", "Espionagem"]),
    ]),
  ],
};

/** Topics ("Subtópico" in the UI) added to existing areas: discipline → area → topics. */
export const V9_TOPICS_FOR_EXISTING: Readonly<Record<string, Readonly<Record<string, readonly CatalogTopic[]>>>> = {};

/** Subtopics ("Detalhe" in the UI) added to existing topics: discipline → topic → subtopics. */
export const V9_SUBTOPICS_FOR_EXISTING: Readonly<Record<string, Readonly<Record<string, readonly CatalogSubtopic[]>>>> = {
  História: {
    "Brasil Colônia": [{ name: "Invasões holandesas", aliases: ["Brasil holandês", "Domínio holandês"] }],
  },
};

/** Appends the v9 topics and subtopics to a discipline; fails on a parent name that does not exist. */
export function withV9Additions(discipline: CatalogDiscipline): CatalogDiscipline {
  const topics = V9_TOPICS_FOR_EXISTING[discipline.name] ?? {};
  const subtopics = V9_SUBTOPICS_FOR_EXISTING[discipline.name] ?? {};
  const pendingAreas = new Set(Object.keys(topics));
  const pendingTopics = new Set(Object.keys(subtopics));

  if (pendingAreas.size === 0 && pendingTopics.size === 0) return discipline;

  const areas = discipline.areas.map((area) => {
    pendingAreas.delete(area.name);

    return {
      ...area,
      topics: [...area.topics, ...(topics[area.name] ?? [])].map((topic) => {
        const extra = subtopics[topic.name];

        if (!extra) return topic;
        pendingTopics.delete(topic.name);

        return { ...topic, subtopics: [...(topic.subtopics ?? []), ...extra] };
      }),
    };
  });
  const missing = [...pendingAreas, ...pendingTopics];

  if (missing.length > 0) {
    throw new Error(`Catalog v9: parent not found in ${discipline.name}: ${missing.join(", ")}`);
  }

  return { ...discipline, areas };
}
