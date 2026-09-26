import { describe, expect, it } from "vitest";

import {
  countCatalog,
  validateCanonicalTaxonomyCatalog,
} from "../../domain/canonical-taxonomy-catalog";

import { ENEM_CANONICAL_TAXONOMY_V1 } from "./enem-canonical-taxonomy-v1";

describe("ENEM_CANONICAL_TAXONOMY_V1", () => {
  it("has no structural issues or semantic duplicates", () => {
    expect(
      validateCanonicalTaxonomyCatalog(
        ENEM_CANONICAL_TAXONOMY_V1,
      ),
    ).toEqual([]);
  });

  it("covers the four ENEM knowledge areas with every discipline assigned", () => {
    const counts = countCatalog(
      ENEM_CANONICAL_TAXONOMY_V1,
    );

    expect(counts.knowledgeAreas).toBe(4);
    expect(counts.disciplines).toBe(14);

    for (const knowledgeArea of ENEM_CANONICAL_TAXONOMY_V1.knowledgeAreas) {
      expect(
        ENEM_CANONICAL_TAXONOMY_V1.disciplines.some(
          (discipline) =>
            discipline.knowledgeAreaSlug === knowledgeArea.slug,
        ),
      ).toBe(true);
    }
  });

  it("keeps the knowledge area slugs used by the legacy ENEM disciplines", () => {
    expect(
      ENEM_CANONICAL_TAXONOMY_V1.knowledgeAreas.map(
        (knowledgeArea) => knowledgeArea.slug,
      ),
    ).toEqual([
      "linguagens-codigos-e-suas-tecnologias",
      "ciencias-humanas-e-suas-tecnologias",
      "ciencias-da-natureza-e-suas-tecnologias",
      "matematica-e-suas-tecnologias",
    ]);
  });
});
