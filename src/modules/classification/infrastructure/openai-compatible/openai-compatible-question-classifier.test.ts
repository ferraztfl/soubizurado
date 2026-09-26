import { describe, expect, it, vi } from "vitest";

import type { QuestionClassificationInput } from "../../domain/question-classifier";
import { TaxonomyIndex } from "../../domain/taxonomy-index";

import {
  describeCandidateTaxonomy,
  OpenAiCompatibleQuestionClassifier,
} from "./openai-compatible-question-classifier";

const index = new TaxonomyIndex({
  version: 1,
  disciplines: [
    { id: "mat", name: "Matemática", slug: "matematica", knowledgeAreaId: "ka", aliases: [] },
  ],
  areas: [{ id: "alg", disciplineId: "mat", name: "Álgebra", aliases: [] }],
  topics: [{ id: "funcoes", disciplineId: "mat", areaId: "alg", name: "Funções", aliases: [] }],
  subtopics: [{ id: "afim", topicId: "funcoes", name: "Função Afim", aliases: [] }],
});

const input: QuestionClassificationInput = {
  questionId: "q",
  statement: "Uma reta de tendência...",
  supportTexts: [],
  alternatives: ["R$ 1 mil", "R$ 2 mil"],
  knowledgeAreaId: "ka",
  disciplineId: "mat",
};

function completion(content: string | null, status = 200): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content } }] }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

function classifierWith(fetchImpl: ReturnType<typeof vi.fn>) {
  const typedFetch = fetchImpl as unknown as (input: string, init: RequestInit) => Promise<Response>;

  return new OpenAiCompatibleQuestionClassifier(
    {
      baseUrl: "https://llm.example/v1/",
      apiKey: "test-key",
      model: "test-model",
      providerLabel: "test",
      timeoutMs: 1_000,
    },
    typedFetch,
  );
}

describe("describeCandidateTaxonomy", () => {
  it("lists only candidate disciplines grouped by area", () => {
    expect(describeCandidateTaxonomy(index, input)).toBe(
      "# Matemática\n  * Álgebra\n    - Funções: Função Afim",
    );
  });
});

describe("OpenAiCompatibleQuestionClassifier", () => {
  it("sends a constrained prompt and parses the JSON answer", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      completion(
        JSON.stringify({
          discipline: "Matemática",
          area: "Álgebra",
          topic: "Funções",
          subtopic: "Função Afim",
          tags: ["gráfico"],
          confidence: 0.93,
        }),
      ),
    );

    const classifier = classifierWith(fetchImpl);
    expect(classifier.version).toBe("oa-v1:test-model");

    const result = await classifier.classify(input, index);

    expect(result).toMatchObject({
      discipline: "Matemática",
      topic: "Funções",
      subtopic: "Função Afim",
      confidence: 0.93,
    });

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://llm.example/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer test-key");

    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ model: "test-model", temperature: 0 });
    expect(body.messages[1].content).toContain("- Funções: Função Afim");
    expect(body.messages[1].content).toContain("(B) R$ 2 mil");
  });

  it("fails without leaking the response body on HTTP errors", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response("secret echo", { status: 429 }));

    await expect(
      classifierWith(fetchImpl).classify(input, index),
    ).rejects.toThrow("Classifier API responded with HTTP 429.");
  });

  it("rejects malformed model output", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(completion("not json"));

    await expect(
      classifierWith(fetchImpl).classify(input, index),
    ).rejects.toThrow("invalid JSON");

    fetchImpl.mockResolvedValue(completion(JSON.stringify({ topic: "Funções" })));

    await expect(
      classifierWith(fetchImpl).classify(input, index),
    ).rejects.toThrow();
  });
});
