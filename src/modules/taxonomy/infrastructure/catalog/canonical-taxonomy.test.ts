import { describe, expect, it } from "vitest";

import {
  countCatalog,
  validateCanonicalTaxonomyCatalog,
} from "../../domain/canonical-taxonomy-catalog";
import { normalizeTaxonomyTerm } from "../../domain/taxonomy-term";

import { CANONICAL_TAXONOMY } from "./canonical-taxonomy";
import { ENEM_CANONICAL_TAXONOMY_V1 } from "./enem-canonical-taxonomy-v1";

describe("CANONICAL_TAXONOMY", () => {
  it("has no structural issues or semantic duplicates", () => {
    expect(validateCanonicalTaxonomyCatalog(CANONICAL_TAXONOMY)).toEqual([]);
  });

  it("only adds to v1 (create-only seed must stay compatible)", () => {
    const v1 = countCatalog(ENEM_CANONICAL_TAXONOMY_V1);
    const v2 = countCatalog(CANONICAL_TAXONOMY);

    expect(CANONICAL_TAXONOMY.version).toBeGreaterThan(ENEM_CANONICAL_TAXONOMY_V1.version);
    expect(v2.disciplines).toBeGreaterThan(v1.disciplines);
    expect(v2.topics).toBeGreaterThan(v1.topics);

    for (const discipline of ENEM_CANONICAL_TAXONOMY_V1.disciplines) {
      const current = CANONICAL_TAXONOMY.disciplines.find(
        (candidate) => candidate.name === discipline.name,
      );

      expect(current?.knowledgeAreaSlug).toBe(discipline.knowledgeAreaSlug);
      expect(current?.areas.slice(0, discipline.areas.length)).toEqual(discipline.areas);
    }
  });

  it("resolves exam board section names through discipline aliases", () => {
    const terms = new Map<string, string>();

    for (const discipline of CANONICAL_TAXONOMY.disciplines) {
      for (const term of [discipline.name, ...(discipline.aliases ?? [])]) {
        terms.set(normalizeTaxonomyTerm(term), discipline.name);
      }
    }

    const boardSections: Record<string, string> = {
      "Legislação Especial": "Legislação Penal Especial",
      Extravagante: "Legislação Penal Especial",
      "Informática Básica": "Informática",
      "Raciocínio Lógico/Matemático": "Raciocínio Lógico",
      "Direitos e Garantias Fundamentais": "Direito Constitucional",
      "Língua Portuguesa": "Língua Portuguesa",
      "Língua Estrangeira - Inglês": "",
    };

    for (const [section, expected] of Object.entries(boardSections)) {
      expect(terms.get(normalizeTaxonomyTerm(section)) ?? "").toBe(expected);
    }
  });
});
