import { describe, expect, it } from "vitest";

import type { CanonicalTaxonomyCatalog } from "../domain/canonical-taxonomy-catalog";

import {
  buildTaxonomySeedPlan,
  countSeedPlan,
  type TaxonomySnapshot,
} from "./build-taxonomy-seed-plan";

const catalog: CanonicalTaxonomyCatalog = {
  version: 1,
  summary: "v1",
  knowledgeAreas: [
    { slug: "matematica-e-suas-tecnologias", name: "Matemática e suas Tecnologias" },
  ],
  disciplines: [
    {
      name: "Matemática",
      aliases: ["Mat"],
      knowledgeAreaSlug: "matematica-e-suas-tecnologias",
      areas: [
        {
          name: "Álgebra",
          topics: [
            {
              name: "Funções",
              subtopics: [
                { name: "Função Afim", aliases: ["Função do 1º grau"] },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const emptySnapshot: TaxonomySnapshot = {
  knowledgeAreas: [],
  disciplines: [],
  areas: [],
  topics: [],
  subtopics: [],
  disciplineAliases: [],
  areaAliases: [],
  topicAliases: [],
  subtopicAliases: [],
  revisionVersions: [],
};

function sequentialIds(): () => string {
  let next = 0;

  return () => {
    next += 1;
    return `id-${next}`;
  };
}

describe("buildTaxonomySeedPlan", () => {
  it("creates the whole catalog on an empty database", () => {
    const plan = buildTaxonomySeedPlan(
      catalog,
      emptySnapshot,
      sequentialIds(),
    );

    expect(plan.conflicts).toEqual([]);
    expect(countSeedPlan(plan)).toEqual({
      knowledgeAreas: 1,
      disciplines: 1,
      disciplineKnowledgeAreaLinks: 0,
      areas: 1,
      topics: 1,
      subtopics: 1,
      disciplineAliases: 1,
      areaAliases: 0,
      topicAliases: 0,
      subtopicAliases: 1,
    });
    expect(plan.revision?.version).toBe(1);

    const [discipline] = plan.disciplines;
    const [area] = plan.areas;
    const [topic] = plan.topics;
    const [subtopic] = plan.subtopics;

    expect(discipline?.slug).toBe("matematica");
    expect(discipline?.knowledgeAreaId).toBe(plan.knowledgeAreas[0]?.id);
    expect(area?.disciplineId).toBe(discipline?.id);
    expect(topic).toMatchObject({
      disciplineId: discipline?.id,
      areaId: area?.id,
      slug: "funcoes",
    });
    expect(subtopic?.topicId).toBe(topic?.id);
    expect(plan.subtopicAliases[0]).toMatchObject({
      subtopicId: subtopic?.id,
      topicId: topic?.id,
      normalizedName: "funcao do 1 grau",
    });
  });

  it("is a no-op when everything already exists", () => {
    const snapshot: TaxonomySnapshot = {
      knowledgeAreas: [{ id: "ka", slug: "matematica-e-suas-tecnologias" }],
      disciplines: [{ id: "d", slug: "matematica", knowledgeAreaId: "ka" }],
      areas: [{ id: "a", disciplineId: "d", slug: "algebra" }],
      topics: [{ id: "t", disciplineId: "d", areaId: "a", slug: "funcoes" }],
      subtopics: [{ id: "s", topicId: "t", slug: "funcao-afim" }],
      disciplineAliases: [{ disciplineId: "d", normalizedName: "mat" }],
      areaAliases: [],
      topicAliases: [],
      subtopicAliases: [
        { subtopicId: "s", topicId: "t", normalizedName: "funcao do 1 grau" },
      ],
      revisionVersions: [1],
    };

    const plan = buildTaxonomySeedPlan(catalog, snapshot, sequentialIds());

    expect(plan.conflicts).toEqual([]);
    expect(Object.values(countSeedPlan(plan)).every((count) => count === 0)).toBe(true);
    expect(plan.revision).toBeNull();
  });

  it("links an existing discipline without a knowledge area but never overrides one", () => {
    const base: TaxonomySnapshot = {
      ...emptySnapshot,
      knowledgeAreas: [{ id: "ka", slug: "matematica-e-suas-tecnologias" }],
    };

    const linked = buildTaxonomySeedPlan(
      catalog,
      { ...base, disciplines: [{ id: "d", slug: "matematica", knowledgeAreaId: null }] },
      sequentialIds(),
    );

    expect(linked.disciplineKnowledgeAreaLinks).toEqual([
      { disciplineId: "d", knowledgeAreaId: "ka" },
    ]);

    const mismatched = buildTaxonomySeedPlan(
      catalog,
      { ...base, disciplines: [{ id: "d", slug: "matematica", knowledgeAreaId: "other" }] },
      sequentialIds(),
    );

    expect(mismatched.disciplineKnowledgeAreaLinks).toEqual([]);
    expect(mismatched.conflicts).toEqual([
      expect.stringContaining("different knowledge area"),
    ]);
  });

  it("reports an alias already owned by another entry instead of moving it", () => {
    const snapshot: TaxonomySnapshot = {
      ...emptySnapshot,
      disciplines: [{ id: "other", slug: "matematica-aplicada", knowledgeAreaId: null }],
      disciplineAliases: [{ disciplineId: "other", normalizedName: "mat" }],
    };

    const plan = buildTaxonomySeedPlan(catalog, snapshot, sequentialIds());

    expect(plan.disciplineAliases).toEqual([]);
    expect(plan.conflicts).toEqual([
      expect.stringContaining('alias "Mat" already belongs to another entry'),
    ]);
  });

  it("reports a topic that exists under a different area", () => {
    const snapshot: TaxonomySnapshot = {
      ...emptySnapshot,
      disciplines: [{ id: "d", slug: "matematica", knowledgeAreaId: null }],
      areas: [{ id: "other-area", disciplineId: "d", slug: "calculo" }],
      topics: [{ id: "t", disciplineId: "d", areaId: "other-area", slug: "funcoes" }],
    };

    const plan = buildTaxonomySeedPlan(catalog, snapshot, sequentialIds());

    expect(plan.topics).toEqual([]);
    expect(plan.conflicts).toContainEqual(
      expect.stringContaining("different assunto"),
    );
  });

  it("refuses to apply an older catalog version", () => {
    const plan = buildTaxonomySeedPlan(
      catalog,
      { ...emptySnapshot, revisionVersions: [2] },
      sequentialIds(),
    );

    expect(plan.revision).toBeNull();
    expect(plan.conflicts).toContainEqual(
      expect.stringContaining("older than the recorded taxonomy version 2"),
    );
  });
});
