import { describe, expect, it } from "vitest";

import type { QuestionClassificationInput } from "../../domain/question-classifier";
import { TaxonomyIndex } from "../../domain/taxonomy-index";

import {
  RuleBasedQuestionClassifier,
  toMatchableText,
} from "./rule-based-question-classifier";

const index = new TaxonomyIndex({
  version: 1,
  disciplines: [
    { id: "mat", name: "Matemática", slug: "matematica", knowledgeAreaId: "ka-mat", aliases: [] },
    { id: "fis", name: "Física", slug: "fisica", knowledgeAreaId: "ka-nat", aliases: [] },
    { id: "bio", name: "Biologia", slug: "biologia", knowledgeAreaId: "ka-nat", aliases: [] },
  ],
  areas: [
    { id: "alg", disciplineId: "mat", name: "Álgebra", aliases: [] },
    { id: "est", disciplineId: "mat", name: "Estatística", aliases: [] },
    { id: "ele", disciplineId: "fis", name: "Eletricidade", aliases: [] },
    { id: "cit", disciplineId: "bio", name: "Citologia", aliases: [] },
  ],
  topics: [
    { id: "funcoes", disciplineId: "mat", areaId: "alg", name: "Funções", aliases: [] },
    { id: "medidas", disciplineId: "mat", areaId: "est", name: "Medidas de Tendência Central", aliases: [] },
    { id: "eletrodinamica", disciplineId: "fis", areaId: "ele", name: "Eletrodinâmica", aliases: [] },
    { id: "metabolismo", disciplineId: "bio", areaId: "cit", name: "Metabolismo Energético", aliases: [] },
  ],
  subtopics: [
    { id: "afim", topicId: "funcoes", name: "Função Afim", aliases: ["Função do 1º grau", "Reta"] },
    { id: "media", topicId: "medidas", name: "Média aritmética", aliases: [] },
    { id: "mediana", topicId: "medidas", name: "Mediana", aliases: [] },
    { id: "resistores", topicId: "eletrodinamica", name: "Resistores e leis de Ohm", aliases: ["Resistor"] },
    { id: "foto", topicId: "metabolismo", name: "Fotossíntese", aliases: [] },
  ],
});

function input(
  overrides: Partial<QuestionClassificationInput>,
): QuestionClassificationInput {
  return {
    questionId: "q",
    statement: "",
    supportTexts: [],
    alternatives: [],
    knowledgeAreaId: null,
    disciplineId: null,
    ...overrides,
  };
}

const classifier = new RuleBasedQuestionClassifier();

describe("toMatchableText", () => {
  it("folds accents and plurals on whole words", () => {
    expect(toMatchableText("Funções e Resistores")).toBe(" funcao e resistor ");
  });
});

describe("RuleBasedQuestionClassifier", () => {
  it("finds the topic inside a known discipline", async () => {
    const result = await classifier.classify(
      input({
        disciplineId: "mat",
        knowledgeAreaId: "ka-mat",
        statement:
          "O gráfico mostra uma reta que representa uma função afim da receita anual.",
      }),
      index,
    );

    expect(result).toMatchObject({
      discipline: "Matemática",
      topic: "Funções",
      subtopic: "Função Afim",
    });
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.confidence).toBeLessThanOrEqual(0.9);
  });

  it("chooses the discipline within the knowledge area", async () => {
    const result = await classifier.classify(
      input({
        knowledgeAreaId: "ka-nat",
        statement:
          "Um resistor ligado a um circuito recebe corrente elétrica de 2 ampere sob tensão elétrica constante.",
      }),
      index,
    );

    expect(result).toMatchObject({
      discipline: "Física",
      topic: "Eletrodinâmica",
    });
  });

  it("returns zero confidence when nothing matches", async () => {
    const result = await classifier.classify(
      input({ knowledgeAreaId: "ka-nat", statement: "Leia o texto a seguir." }),
      index,
    );

    expect(result).toMatchObject({ topic: null, confidence: 0 });
  });

  it("reports a discipline without topic at low confidence", async () => {
    const result = await classifier.classify(
      input({
        knowledgeAreaId: "ka-nat",
        statement: "A célula e o DNA de uma espécie de bactéria foram estudados.",
      }),
      index,
    );

    expect(result).toMatchObject({ discipline: "Biologia", topic: null });
    expect(result.confidence).toBeLessThanOrEqual(0.5);
  });
});

describe("RuleBasedQuestionClassifier legal references", () => {
  const legalIndex = new TaxonomyIndex({
    version: 2,
    disciplines: [
      { id: "lpe", name: "Legislação Penal Especial", slug: "legislacao-penal-especial", knowledgeAreaId: "cj", aliases: [] },
      { id: "dc", name: "Direito Constitucional", slug: "direito-constitucional", knowledgeAreaId: "cj", aliases: [] },
    ],
    areas: [
      { id: "prot", disciplineId: "lpe", name: "Proteção de Grupos Vulneráveis", aliases: [] },
      { id: "dgf", disciplineId: "dc", name: "Direitos e Garantias Fundamentais na Constituição", aliases: [] },
    ],
    topics: [
      { id: "mp", disciplineId: "lpe", areaId: "prot", name: "Lei Maria da Penha", aliases: [] },
      { id: "art5", disciplineId: "dc", areaId: "dgf", name: "Direitos e Deveres Individuais e Coletivos", aliases: [] },
    ],
    subtopics: [],
  });

  it("classifies a cited law with high confidence", async () => {
    const result = await new RuleBasedQuestionClassifier().classify(
      input({
        statement: "Nessa situação, à luz da Lei no 11.340/2006, é correto afirmar que as condutas configuram violência",
        knowledgeAreaId: "cj",
      }),
      legalIndex,
    );

    expect(result).toMatchObject({
      discipline: "Legislação Penal Especial",
      area: "Proteção de Grupos Vulneráveis",
      topic: "Lei Maria da Penha",
      confidence: 0.92,
    });
  });

  it("ignores a reference outside the question Matéria", async () => {
    const result = await new RuleBasedQuestionClassifier().classify(
      input({
        statement: "Segundo a Lei no 11.340/2006, assinale a correta.",
        knowledgeAreaId: "cj",
        disciplineId: "dc",
      }),
      legalIndex,
    );

    expect(result.topic).not.toBe("Lei Maria da Penha");
    expect(result.confidence).toBeLessThan(0.8);
  });
});
