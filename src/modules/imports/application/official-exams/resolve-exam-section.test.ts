import { describe, expect, it } from "vitest";

import { CANONICAL_TAXONOMY } from "@/modules/taxonomy/infrastructure/catalog/canonical-taxonomy";
import { normalizeTaxonomyTerm } from "@/modules/taxonomy/domain/taxonomy-term";

import {
  resolveExamSection,
  type SectionTaxonomyEntry,
} from "./resolve-exam-section";

// Uses the real catalog so alias gaps show up as test failures.
const entries: SectionTaxonomyEntry[] = CANONICAL_TAXONOMY.disciplines
  .filter((discipline) => discipline.knowledgeAreaSlug)
  .map((discipline) => ({
    disciplineName: discipline.name,
    knowledgeAreaSlug: discipline.knowledgeAreaSlug!,
    terms: [discipline.name, ...(discipline.aliases ?? [])].map(normalizeTaxonomyTerm),
  }));

function resolve(section: string | null) {
  return resolveExamSection(section, entries);
}

describe("resolveExamSection", () => {
  it.each([
    ["Língua Portuguesa", "Língua Portuguesa"],
    ["Informática Básica", "Informática"],
    ["Legislação Especial", "Legislação Penal Especial"],
    ["Extravagante", "Legislação Penal Especial"],
    ["Raciocínio Lógico/Matemático", "Raciocínio Lógico"],
    ["Direitos e Garantias Fundamentais", "Direito Constitucional"],
    ["Direito Penal Militar", "Direito Penal Militar"],
    ["Direito Processual Penal Militar", "Direito Processual Penal Militar"],
    ["Estatística", "Estatística"],
    ["Direitos Humanos", "Direitos Humanos"],
  ])("maps %s to the discipline %s", (section, discipline) => {
    expect(resolve(section)).toMatchObject({ kind: "DISCIPLINE", disciplineName: discipline });
  });

  it("maps names that contain exactly one discipline", () => {
    expect(resolve("Língua Estrangeira - Inglês")).toMatchObject({
      kind: "DISCIPLINE",
      disciplineName: "Língua Inglesa",
    });
    expect(resolve("Língua Estrangeira - Espanhol")).toMatchObject({
      kind: "DISCIPLINE",
      disciplineName: "Língua Espanhola",
    });
    expect(resolve("História de Pernambuco")).toMatchObject({
      kind: "DISCIPLINE",
      disciplineName: "História",
    });
  });

  it("keeps only the knowledge area for multi-discipline or generic legal sections", () => {
    expect(
      resolve("Noções de Direito Administrativo, Noções de Direito Constitucional, Legislação Específica e"),
    ).toEqual({ kind: "KNOWLEDGE_AREA", knowledgeAreaSlug: "ciencias-juridicas" });
    expect(resolve("Noções de Direito")).toEqual({
      kind: "KNOWLEDGE_AREA",
      knowledgeAreaSlug: "ciencias-juridicas",
    });
  });

  it("leaves unknown sections for a reviewer", () => {
    expect(resolve("Conhecimentos Específicos")).toEqual({ kind: "UNRESOLVED" });
    expect(resolve(null)).toEqual({ kind: "UNRESOLVED" });
  });
});
