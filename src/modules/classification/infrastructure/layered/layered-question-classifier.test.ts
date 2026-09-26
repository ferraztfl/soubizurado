import { describe, expect, it, vi } from "vitest";

import type {
  ProviderClassification,
  QuestionClassificationInput,
  QuestionClassifier,
} from "../../domain/question-classifier";
import { TaxonomyIndex } from "../../domain/taxonomy-index";

import { LayeredQuestionClassifier } from "./layered-question-classifier";

const taxonomy = new TaxonomyIndex({
  version: 2,
  disciplines: [
    { id: "dc", name: "Direito Constitucional", slug: "direito-constitucional", knowledgeAreaId: "cj", aliases: [] },
  ],
  areas: [{ id: "dgf", disciplineId: "dc", name: "Direitos e Garantias Fundamentais", aliases: [] }],
  topics: [{ id: "art5", disciplineId: "dc", areaId: "dgf", name: "Direitos e Deveres Individuais", aliases: [] }],
  subtopics: [],
});

const input: QuestionClassificationInput = {
  questionId: "q1",
  statement: "Nos termos do art. 5º da Constituição...",
  supportTexts: [],
  alternatives: [],
  knowledgeAreaId: "cj",
  disciplineId: "dc",
};

function fake(result: Partial<ProviderClassification>, version = "fake-v1"): QuestionClassifier {
  return {
    provider: "fake",
    model: "fake-model",
    version,
    classify: vi.fn(async (_input, _taxonomy, options) => {
      await options?.beforeRemoteCall?.();
      return {
        discipline: null,
        area: null,
        topic: null,
        subtopic: null,
        tags: [],
        confidence: 0,
        ...result,
      };
    }),
  };
}

describe("LayeredQuestionClassifier", () => {
  it("keeps a confident rule result and never calls the AI", async () => {
    const rules = fake({ discipline: "Direito Constitucional", topic: "Direitos e Deveres Individuais", confidence: 0.7 });
    const ai = fake({ topic: "Outro" });
    const beforeRemoteCall = vi.fn();

    const result = await new LayeredQuestionClassifier(rules, ai, 0.6).classify(input, taxonomy, {
      beforeRemoteCall,
    });

    expect(result.layer).toBe("RULES");
    expect(result.topic).toBe("Direitos e Deveres Individuais");
    expect(ai.classify).not.toHaveBeenCalled();
    expect(beforeRemoteCall).not.toHaveBeenCalled();
  });

  it("falls back to the AI below the threshold", async () => {
    const rules = fake({ discipline: "Direito Constitucional", topic: "Direitos e Deveres Individuais", confidence: 0.59 });
    const ai = fake({ discipline: "Direito Constitucional", topic: "Direitos e Deveres Individuais", confidence: 0.95 });
    const beforeRemoteCall = vi.fn();

    const result = await new LayeredQuestionClassifier(rules, ai, 0.6).classify(input, taxonomy, {
      beforeRemoteCall,
    });

    expect(result.layer).toBe("AI");
    expect(result.confidence).toBe(0.95);
    expect(beforeRemoteCall).toHaveBeenCalledTimes(1);
  });

  it("falls back to the AI when the rules name an unknown topic", async () => {
    const rules = fake({ discipline: "Direito Constitucional", topic: "Inexistente", confidence: 0.9 });
    const ai = fake({ topic: "Direitos e Deveres Individuais", confidence: 0.9 });

    const result = await new LayeredQuestionClassifier(rules, ai, 0.6).classify(input, taxonomy);

    expect(result.layer).toBe("AI");
  });

  it("builds a version that fits the database column", () => {
    const classifier = new LayeredQuestionClassifier(fake({}), fake({}, "oa-v2:gemini-3.5-flash-lite"), 0.6);

    expect(classifier.version).toBe("lay1:oa-v2:gemini-3.5-flash-lite");
    expect(classifier.version.length).toBeLessThanOrEqual(40);
    expect(() => new LayeredQuestionClassifier(fake({}), fake({}), 1.5)).toThrow();
  });

  it("uses the local AI before the remote one and skips it when it fails", async () => {
    const rules = fake({ confidence: 0 });
    const good = { discipline: "Direito Constitucional", topic: "Direitos e Deveres Individuais", confidence: 0.95 };
    const beforeRemoteCall = vi.fn();

    const local = fake(good, "local-v1");
    const remote = fake(good);
    const withLocal = new LayeredQuestionClassifier(rules, remote, 0.8, { classifier: local, threshold: 0.9 });

    expect((await withLocal.classify(input, taxonomy, { beforeRemoteCall })).layer).toBe("LOCAL_AI");
    expect(remote.classify).not.toHaveBeenCalled();
    expect(beforeRemoteCall).not.toHaveBeenCalled();

    const unsure = fake({ ...good, confidence: 0.85 }, "local-v1");
    const escalated = new LayeredQuestionClassifier(rules, remote, 0.8, { classifier: unsure, threshold: 0.9 });
    expect((await escalated.classify(input, taxonomy)).layer).toBe("AI");

    const offline: QuestionClassifier = {
      provider: "ollama",
      model: "qwen2.5:3b",
      version: "oa-v2:qwen2.5:3b",
      classify: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    };
    const fallback = new LayeredQuestionClassifier(rules, remote, 0.8, { classifier: offline, threshold: 0.9 });
    expect((await fallback.classify(input, taxonomy)).layer).toBe("AI");
  });

  it("names the local + remote chain in the version", () => {
    const local: QuestionClassifier = { ...fake({}), model: "qwen2.5:3b" };
    const remote: QuestionClassifier = { ...fake({}), model: "gemini-3.5-flash-lite" };
    const classifier = new LayeredQuestionClassifier(fake({}), remote, 0.8, { classifier: local, threshold: 0.9 });

    expect(classifier.version).toBe("lay2:qwen2.5:3b>gemini-3.5-flash-lite");
  });
});
