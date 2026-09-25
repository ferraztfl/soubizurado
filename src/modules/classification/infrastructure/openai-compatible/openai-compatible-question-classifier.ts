import { z } from "zod";

import type {
  ProviderClassification,
  QuestionClassificationInput,
  QuestionClassifier,
} from "../../domain/question-classifier";
import type { TaxonomyIndex } from "../../domain/taxonomy-index";

/*
 * Classifier for any OpenAI-compatible chat completions API: OpenAI,
 * Gemini's OpenAI endpoint, OpenRouter, vLLM, Ollama, LM Studio...
 * The model only sees and returns taxonomy NAMES from the candidate
 * list; the backend resolver maps them to ids and drops anything else.
 */

export type OpenAiCompatibleConfig = Readonly<{
  baseUrl: string;
  apiKey: string | null;
  model: string;
  /** Label stored in the task, e.g. "openai", "gemini", "ollama". */
  providerLabel: string;
  timeoutMs: number;
}>;

type FetchLike = (
  input: string,
  init: RequestInit,
) => Promise<Response>;

const MAX_TEXT_LENGTH = 6_000;

const responseSchema = z.object({
  discipline: z.string().nullable().optional(),
  area: z.string().nullable().optional(),
  topic: z.string().nullable().optional(),
  subtopic: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  confidence: z.number(),
  rationale: z.string().optional(),
});

const completionSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable(),
        }),
      }),
    )
    .min(1),
});

function truncate(value: string): string {
  return value.length > MAX_TEXT_LENGTH
    ? `${value.slice(0, MAX_TEXT_LENGTH)}…`
    : value;
}

export function describeCandidateTaxonomy(
  taxonomy: TaxonomyIndex,
  input: QuestionClassificationInput,
): string {
  return taxonomy
    .candidateDisciplines(input)
    .map((discipline) => {
      const byArea = new Map<string, string[]>();

      for (const topic of discipline.topics) {
        const area = topic.areaName ?? "Sem assunto";
        const subtopics = topic.subtopics.map((subtopic) => subtopic.name);
        const line = subtopics.length
          ? `    - ${topic.name}: ${subtopics.join("; ")}`
          : `    - ${topic.name}`;

        byArea.set(area, [...(byArea.get(area) ?? []), line]);
      }

      const areas = [...byArea.entries()]
        .map(([area, lines]) => `  * ${area}\n${lines.join("\n")}`)
        .join("\n");

      return `# ${discipline.name}\n${areas}`;
    })
    .join("\n");
}

const SYSTEM_PROMPT = [
  "Você classifica questões de vestibular/ENEM numa taxonomia fechada.",
  "Use SOMENTE nomes exatamente como aparecem na taxonomia fornecida.",
  "Nunca invente disciplina, assunto, tópico ou subtópico.",
  "Se nenhum tópico se aplicar com segurança, retorne topic null e confiança baixa.",
  "Subtópico é opcional: só indique quando claramente aplicável.",
  "Responda apenas com JSON: {\"discipline\",\"area\",\"topic\",\"subtopic\",\"tags\",\"confidence\",\"rationale\"}.",
  "confidence é um número entre 0 e 1. tags: até 5 termos curtos em português.",
].join("\n");

export class OpenAiCompatibleQuestionClassifier implements QuestionClassifier {
  public readonly provider: string;
  public readonly model: string;
  public readonly version = "openai-compatible-v1";

  public constructor(
    private readonly config: OpenAiCompatibleConfig,
    private readonly fetchImpl: FetchLike = fetch,
  ) {
    this.provider = config.providerLabel;
    this.model = config.model;
  }

  public async classify(
    input: QuestionClassificationInput,
    taxonomy: TaxonomyIndex,
  ): Promise<ProviderClassification> {
    const question = [
      truncate(input.statement),
      ...input.supportTexts.map((text) => `Texto de apoio: ${truncate(text)}`),
      ...input.alternatives.map(
        (alternative, index) =>
          `(${String.fromCharCode(65 + index)}) ${truncate(alternative)}`,
      ),
    ].join("\n");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    let response: Response;

    try {
      response = await this.fetchImpl(
        `${this.config.baseUrl.replace(/\/+$/, "")}/chat/completions`,
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            ...(this.config.apiKey
              ? { Authorization: `Bearer ${this.config.apiKey}` }
              : {}),
          },
          body: JSON.stringify({
            model: this.config.model,
            temperature: 0,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              {
                role: "user",
                content: `Taxonomia permitida:\n${describeCandidateTaxonomy(taxonomy, input)}\n\nQuestão:\n${question}`,
              },
            ],
          }),
        },
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      // Body may echo request data; keep only the status.
      throw new Error(`Classifier API responded with HTTP ${response.status}.`);
    }

    const completion = completionSchema.parse(await response.json());
    const content = completion.choices[0]?.message.content;

    if (!content) {
      throw new Error("Classifier API returned an empty message.");
    }

    let parsedJson: unknown;

    try {
      parsedJson = JSON.parse(content);
    } catch {
      throw new Error("Classifier API returned invalid JSON.");
    }

    const parsed = responseSchema.parse(parsedJson);

    return {
      discipline: parsed.discipline ?? null,
      area: parsed.area ?? null,
      topic: parsed.topic ?? null,
      subtopic: parsed.subtopic ?? null,
      tags: parsed.tags ?? [],
      confidence: parsed.confidence,
      rationale: parsed.rationale,
    };
  }
}
