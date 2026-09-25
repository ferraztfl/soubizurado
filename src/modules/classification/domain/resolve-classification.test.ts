import { describe, expect, it } from "vitest";

import type { ProviderClassification } from "./question-classifier";
import {
  decideClassificationStatus,
  resolveProviderClassification,
} from "./resolve-classification";
import { TaxonomyIndex } from "./taxonomy-index";

const index = new TaxonomyIndex({
  version: 1,
  disciplines: [
    { id: "mat", name: "Matemática", slug: "matematica", knowledgeAreaId: "ka-mat", aliases: [] },
    { id: "fis", name: "Física", slug: "fisica", knowledgeAreaId: "ka-nat", aliases: [] },
    { id: "qui", name: "Química", slug: "quimica", knowledgeAreaId: "ka-nat", aliases: [] },
    { id: "legacy", name: "Ciências da Natureza", slug: "ciencias-da-natureza-e-suas-tecnologias", knowledgeAreaId: null, aliases: [] },
  ],
  areas: [
    { id: "alg", disciplineId: "mat", name: "Álgebra", aliases: [] },
    { id: "mec", disciplineId: "fis", name: "Mecânica", aliases: [] },
    { id: "fq", disciplineId: "qui", name: "Físico-Química", aliases: [] },
    { id: "qg", disciplineId: "qui", name: "Química Geral", aliases: [] },
  ],
  topics: [
    { id: "funcoes", disciplineId: "mat", areaId: "alg", name: "Funções", aliases: [] },
    { id: "cinematica", disciplineId: "fis", areaId: "mec", name: "Cinemática", aliases: [] },
    { id: "energia-fis", disciplineId: "fis", areaId: "mec", name: "Energia", aliases: [] },
    { id: "energia-qui", disciplineId: "qui", areaId: "qg", name: "Energia", aliases: [] },
    { id: "solucoes", disciplineId: "qui", areaId: "fq", name: "Soluções", aliases: ["Concentração"] },
  ],
  subtopics: [
    { id: "afim", topicId: "funcoes", name: "Função Afim", aliases: ["Função do 1º grau"] },
  ],
});

function result(
  overrides: Partial<ProviderClassification>,
): ProviderClassification {
  return {
    discipline: null,
    area: null,
    topic: null,
    subtopic: null,
    tags: [],
    confidence: 0.9,
    ...overrides,
  };
}

describe("TaxonomyIndex.candidateDisciplines", () => {
  it("excludes legacy disciplines without a knowledge area", () => {
    expect(
      index
        .candidateDisciplines({ disciplineId: null, knowledgeAreaId: null })
        .map((discipline) => discipline.id),
    ).toEqual(["mat", "fis", "qui"]);
  });

  it("restricts to the knowledge area or the current discipline", () => {
    expect(
      index
        .candidateDisciplines({ disciplineId: null, knowledgeAreaId: "ka-nat" })
        .map((discipline) => discipline.id),
    ).toEqual(["fis", "qui"]);

    expect(
      index
        .candidateDisciplines({ disciplineId: "mat", knowledgeAreaId: "ka-mat" })
        .map((discipline) => discipline.id),
    ).toEqual(["mat"]);
  });
});

describe("resolveProviderClassification", () => {
  it("resolves names and aliases to ids, deriving the area from the topic", () => {
    const resolved = resolveProviderClassification(
      index,
      { disciplineId: "mat", knowledgeAreaId: "ka-mat" },
      result({ topic: "funcoes", subtopic: "Função do 1° grau", area: "Álgebra" }),
    );

    expect(resolved).toMatchObject({
      disciplineId: "mat",
      areaId: "alg",
      topicId: "funcoes",
      subtopicId: "afim",
      issues: [],
    });
  });

  it("infers the discipline from a topic unique within the knowledge area", () => {
    const resolved = resolveProviderClassification(
      index,
      { disciplineId: null, knowledgeAreaId: "ka-nat" },
      result({ topic: "Concentração" }),
    );

    expect(resolved).toMatchObject({ disciplineId: "qui", topicId: "solucoes" });
  });

  it("refuses ambiguous topics without a discipline", () => {
    const resolved = resolveProviderClassification(
      index,
      { disciplineId: null, knowledgeAreaId: "ka-nat" },
      result({ topic: "Energia" }),
    );

    expect(resolved.topicId).toBeNull();
    expect(resolved.issues).toContainEqual({ code: "TOPIC_AMBIGUOUS", value: "Energia" });
  });

  it("ignores disciplines outside the knowledge area and never invents topics", () => {
    const resolved = resolveProviderClassification(
      index,
      { disciplineId: null, knowledgeAreaId: "ka-nat" },
      result({ discipline: "Matemática", topic: "Funções Hiperbólicas" }),
    );

    expect(resolved).toMatchObject({ disciplineId: null, topicId: null });
    expect(resolved.issues.map((issue) => issue.code)).toEqual([
      "DISCIPLINE_OUT_OF_SCOPE",
      "TOPIC_UNKNOWN",
      "DISCIPLINE_UNDETERMINED",
    ]);
  });

  it("keeps the topic when only the area or subtopic disagree", () => {
    const resolved = resolveProviderClassification(
      index,
      { disciplineId: "mat", knowledgeAreaId: "ka-mat" },
      result({ topic: "Funções", area: "Geometria", subtopic: "Função Zeta" }),
    );

    expect(resolved.topicId).toBe("funcoes");
    expect(resolved.subtopicId).toBeNull();
    expect(decideClassificationStatus(resolved, 0.8)).toBe("COMPLETED");
  });

  it("sanitizes tags and clamps confidence", () => {
    const resolved = resolveProviderClassification(
      index,
      { disciplineId: "mat", knowledgeAreaId: "ka-mat" },
      result({
        topic: "Funções",
        tags: [" gráficos ", "gráficos", "", "x".repeat(200)],
        confidence: 7,
      }),
    );

    expect(resolved.tags).toEqual(["gráficos"]);
    expect(resolved.confidence).toBe(1);
  });
});

describe("decideClassificationStatus", () => {
  const complete = resolveProviderClassification(
    index,
    { disciplineId: "mat", knowledgeAreaId: "ka-mat" },
    result({ topic: "Funções", confidence: 0.85 }),
  );

  it("marks confident complete suggestions as COMPLETED", () => {
    expect(decideClassificationStatus(complete, 0.8)).toBe("COMPLETED");
  });

  it("requires review below the threshold or without a topic", () => {
    expect(decideClassificationStatus(complete, 0.9)).toBe("REVIEW_REQUIRED");

    const missing = resolveProviderClassification(
      index,
      { disciplineId: "mat", knowledgeAreaId: "ka-mat" },
      result({}),
    );

    expect(decideClassificationStatus(missing, 0)).toBe("REVIEW_REQUIRED");
  });
});
