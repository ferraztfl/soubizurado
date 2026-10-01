import { describe, expect, it } from "vitest";

import { SimilarQuestionClassifier, type ClassifiedExample } from "./similar-question-classifier";
import { tokenize } from "./text-vectors";

const example = (id: string, topic: string, text: string, subtopic: string | null = null): ClassifiedExample => ({
  questionId: id,
  knowledgeAreaId: "area-1",
  disciplineId: "disc-1",
  text,
  discipline: "Direito Penal",
  area: "Crimes",
  topic,
  subtopic,
});

const base = [
  example("q1", "Crimes contra a vida", "O homicídio simples consiste em matar alguém e a pena é de reclusão de seis a vinte anos."),
  example("q2", "Crimes contra a vida", "No homicídio qualificado por motivo torpe a pena de reclusão aumenta para doze a trinta anos."),
  example("q3", "Crimes contra o patrimônio", "O furto consiste em subtrair coisa alheia móvel e o roubo exige violência ou grave ameaça."),
  example("q4", "Crimes contra o patrimônio", "A extorsão e o roubo são crimes contra o patrimônio praticados com grave ameaça."),
];

const input = (statement: string, questionId = "novo") => ({
  questionId,
  statement,
  supportTexts: [],
  alternatives: [],
  knowledgeAreaId: "area-1",
  disciplineId: "disc-1",
});

describe("tokenize", () => {
  it("folds accents, drops stopwords and short numbers, and adds word pairs", () => {
    expect(tokenize("O Homicídio qualificado, art. 121")).toEqual(["homicidio", "qualificado", "art", "121", "homicidio_qualificado", "qualificado_art", "art_121"]);
  });
});

describe("SimilarQuestionClassifier", () => {
  const classifier = new SimilarQuestionClassifier(base);

  it("answers with the path of the closest classified questions and a confidence", async () => {
    const answer = await classifier.classify(input("A pena do homicídio simples é de reclusão de seis a vinte anos."));

    expect(answer.topic).toBe("Crimes contra a vida");
    expect(answer.discipline).toBe("Direito Penal");
    expect(answer.confidence).toBeGreaterThan(0.7);
  });

  it("separates topics by their vocabulary", async () => {
    const answer = await classifier.classify(input("O roubo se diferencia do furto pela violência ou grave ameaça contra a vítima."));

    expect(answer.topic).toBe("Crimes contra o patrimônio");
  });

  it("answers nothing when there is nothing alike inside the Matéria", async () => {
    const answer = await classifier.classify({ ...input("Fotossíntese e respiração celular nas plantas."), disciplineId: "outra" });

    expect(answer.topic).toBeNull();
    expect(answer.confidence).toBe(0);
  });

  it("never uses the question itself as its own example", async () => {
    const answer = await classifier.classify(input("O homicídio simples consiste em matar alguém e a pena é de reclusão de seis a vinte anos.", "q1"));

    // Only q2 is left in its topic: still the right topic, but not a perfect copy.
    expect(answer.topic).toBe("Crimes contra a vida");
    expect(answer.confidence).toBeLessThan(0.99);
  });

  it("suggests a Detalhe only when the close neighbours agree on it", async () => {
    const withDetail = new SimilarQuestionClassifier([
      example("a", "Crimes contra a vida", "O infanticídio ocorre sob a influência do estado puerperal logo após o parto.", "Infanticídio"),
      example("b", "Crimes contra o patrimônio", "O furto consiste em subtrair coisa alheia móvel para si ou para outrem."),
      example("c", "Crimes contra o patrimônio", "O roubo exige violência ou grave ameaça para subtrair coisa alheia móvel."),
    ]);
    const answer = await withDetail.classify(input("O infanticídio ocorre sob a influência do estado puerperal logo após o parto da mãe."));

    expect(answer.subtopic).toBe("Infanticídio");
  });
});
