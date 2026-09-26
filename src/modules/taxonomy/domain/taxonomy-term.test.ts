import { describe, expect, it } from "vitest";

import {
  normalizeTaxonomyTerm,
  toTaxonomySlug,
} from "./taxonomy-term";

describe("normalizeTaxonomyTerm", () => {
  it("ignores accents, case and surrounding whitespace", () => {
    expect(
      normalizeTaxonomyTerm("  Função  Afim "),
    ).toBe("funcao afim");
  });

  it("folds ordinal markers into the number", () => {
    expect(
      normalizeTaxonomyTerm("Função do 1º Grau"),
    ).toBe(
      normalizeTaxonomyTerm("funcao do 1 grau"),
    );

    expect(
      normalizeTaxonomyTerm("2ª Guerra Mundial"),
    ).toBe("2 guerra mundial");

    expect(
      normalizeTaxonomyTerm("Equação do 2° grau"),
    ).toBe("equacao do 2 grau");
  });

  it("keeps words and connectors that follow a number", () => {
    expect(
      normalizeTaxonomyTerm("3 ondas"),
    ).toBe("3 ondas");

    expect(
      normalizeTaxonomyTerm("de 2 a 3 anos"),
    ).toBe("de 2 a 3 anos");
  });

  it("treats punctuation as separators", () => {
    expect(
      normalizeTaxonomyTerm(
        "Termologia/Calorimetria — (Básico)",
      ),
    ).toBe("termologia calorimetria basico");
  });

  it("does not fold different wording", () => {
    expect(
      normalizeTaxonomyTerm("Função do primeiro grau"),
    ).not.toBe(
      normalizeTaxonomyTerm("Função do 1º grau"),
    );
  });

  it("returns an empty string for symbol-only input", () => {
    expect(
      normalizeTaxonomyTerm(" -- / "),
    ).toBe("");
  });
});

describe("toTaxonomySlug", () => {
  it("joins normalized words with hyphens", () => {
    expect(
      toTaxonomySlug("Geometria Plana e Espacial"),
    ).toBe("geometria-plana-e-espacial");
  });
});
