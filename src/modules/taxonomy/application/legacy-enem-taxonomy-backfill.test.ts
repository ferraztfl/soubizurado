import { describe, expect, it } from "vitest";

import { ENEM_CANONICAL_TAXONOMY_V1 } from "../infrastructure/catalog/enem-canonical-taxonomy-v1";
import { toTaxonomySlug } from "../domain/taxonomy-term";

import {
  LEGACY_ENEM_DISCIPLINE_MOVE_RULES,
  LEGACY_ENEM_KNOWLEDGE_AREA_SLUGS,
  resolveLegacyBackfillRules,
  type TaxonomyIdLookup,
} from "./legacy-enem-taxonomy-backfill";

function fullLookup(): TaxonomyIdLookup {
  return {
    legacyDisciplineIdBySlug: new Map(
      LEGACY_ENEM_KNOWLEDGE_AREA_SLUGS.map((slug) => [slug, `legacy:${slug}`]),
    ),
    knowledgeAreaIdBySlug: new Map(
      LEGACY_ENEM_KNOWLEDGE_AREA_SLUGS.map((slug) => [slug, `ka:${slug}`]),
    ),
    disciplineIdBySlug: new Map(
      ENEM_CANONICAL_TAXONOMY_V1.disciplines.map((discipline) => [
        toTaxonomySlug(discipline.name),
        `d:${toTaxonomySlug(discipline.name)}`,
      ]),
    ),
    knowledgeAreaIdByDisciplineSlug: new Map(
      ENEM_CANONICAL_TAXONOMY_V1.disciplines.map((discipline) => [
        toTaxonomySlug(discipline.name),
        discipline.knowledgeAreaSlug ? `ka:${discipline.knowledgeAreaSlug}` : null,
      ]),
    ),
  };
}

describe("LEGACY_ENEM_DISCIPLINE_MOVE_RULES", () => {
  it("only targets disciplines that exist in the canonical catalog", () => {
    const catalogSlugs = new Set(
      ENEM_CANONICAL_TAXONOMY_V1.disciplines.map((discipline) =>
        toTaxonomySlug(discipline.name),
      ),
    );

    for (const rule of LEGACY_ENEM_DISCIPLINE_MOVE_RULES) {
      expect(catalogSlugs.has(rule.toDisciplineSlug)).toBe(true);
    }
  });
});

describe("resolveLegacyBackfillRules", () => {
  it("resolves every fill and move when the seed has run", () => {
    const rules = resolveLegacyBackfillRules(fullLookup());

    expect(rules.problems).toEqual([]);
    expect(rules.knowledgeAreaFills).toHaveLength(4);
    expect(rules.disciplineMoves.map((rule) => rule.code)).toEqual([
      "MATEMATICA",
      "LINGUA_INGLESA",
      "LINGUA_ESPANHOLA",
    ]);
    expect(rules.disciplineMoves[0]).toEqual({
      code: "MATEMATICA",
      legacyDisciplineId: "legacy:matematica-e-suas-tecnologias",
      targetDisciplineId: "d:matematica",
      targetKnowledgeAreaId: "ka:matematica-e-suas-tecnologias",
      signal: { kind: "ALL" },
    });
  });

  it("reports missing canonical rows instead of guessing", () => {
    const lookup = fullLookup();
    const disciplineIdBySlug = new Map(lookup.disciplineIdBySlug);
    disciplineIdBySlug.delete("lingua-inglesa");

    const rules = resolveLegacyBackfillRules({
      ...lookup,
      disciplineIdBySlug,
    });

    expect(rules.problems).toEqual([
      expect.stringContaining('"lingua-inglesa" is missing'),
    ]);
    expect(rules.disciplineMoves.map((rule) => rule.code)).not.toContain(
      "LINGUA_INGLESA",
    );
  });

  it("refuses a target linked to another knowledge area", () => {
    const lookup = fullLookup();
    const knowledgeAreaIdByDisciplineSlug = new Map(
      lookup.knowledgeAreaIdByDisciplineSlug,
    );
    knowledgeAreaIdByDisciplineSlug.set(
      "matematica",
      "ka:ciencias-da-natureza-e-suas-tecnologias",
    );

    const rules = resolveLegacyBackfillRules({
      ...lookup,
      knowledgeAreaIdByDisciplineSlug,
    });

    expect(rules.problems).toEqual([
      expect.stringContaining('"matematica" is not linked'),
    ]);
  });

  it("skips rules whose legacy discipline no longer exists", () => {
    const lookup = fullLookup();

    const rules = resolveLegacyBackfillRules({
      ...lookup,
      legacyDisciplineIdBySlug: new Map(),
    });

    expect(rules.problems).toEqual([]);
    expect(rules.knowledgeAreaFills).toEqual([]);
    expect(rules.disciplineMoves).toEqual([]);
  });
});
