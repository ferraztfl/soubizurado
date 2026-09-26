import { z } from "zod";

import type {
  ClassifyOptions,
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
  /** "compact" (default, v3) or "labelled" (v2, the original prompt). */
  promptStyle?: "labelled" | "compact";
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
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative().optional(),
      completion_tokens: z.number().int().nonnegative().optional(),
    })
    .optional(),
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

      // Every level is labelled explicitly: an unlabelled "topic: a; b"
      // line made models return the area as topic and the whole line
      // as subtopic.
      for (const topic of discipline.topics) {
        const area = topic.areaName ?? "Sem assunto";
        const lines = [`    TÓPICO: ${topic.name}`];

        if (topic.subtopics.length > 0) {
          lines.push(
            `      SUBTÓPICOS: ${topic.subtopics
              .map((subtopic) => subtopic.name)
              .join(" | ")}`,
          );
        }

        byArea.set(area, [...(byArea.get(area) ?? []), ...lines]);
      }

      const areas = [...byArea.entries()]
        .map(([area, lines]) => `  ASSUNTO: ${area}\n${lines.join("\n")}`)
        .join("\n");

      return `DISCIPLINA: ${discipline.name}\n${areas}`;
    })
    .join("\n");
}

/**
 * Compact taxonomy (prompt v3): one short marker per level and no
 * Subtopic ("Detalhe") level, which is optional and was half of the
 * prompt. Measured on 2,935 questions: 49% fewer input characters.
 *
 *   D Biologia
 *   A Genética
 *   - Herança e Heredogramas
 */
export function describeCandidateTaxonomyCompact(
  taxonomy: TaxonomyIndex,
  input: QuestionClassificationInput,
): string {
  return taxonomy
    .candidateDisciplines(input)
    .map((discipline) => {
      const byArea = new Map<string, string[]>();

      for (const topic of discipline.topics) {
        const area = topic.areaName ?? "Geral";

        byArea.set(area, [...(byArea.get(area) ?? []), `- ${topic.name}`]);
      }

      const areas = [...byArea.entries()].map(([area, lines]) => `A ${area}\n${lines.join("\n")}`).join("\n");

      return `D ${discipline.name}\n${areas}`;
    })
    .join("\n");
}

// Short answer on purpose: output tokens cost ~8x input tokens.
const COMPACT_SYSTEM_PROMPT = [
  "Classifique a questão (ENEM/concursos) na taxonomia fechada fornecida.",
  "Formato: linha 'D <disciplina>', linha 'A <assunto>', linhas '- <tópico>'.",
  "Use SOMENTE nomes exatamente como escritos; nunca invente.",
  "discipline = nome após 'D'; topic = nome após '- '.",
  "Se nenhum tópico servir com segurança, retorne topic null e confidence baixa.",
  "Responda só JSON: {\"discipline\",\"topic\",\"confidence\",\"rationale\"}; confidence de 0 a 1; rationale com no máximo 12 palavras.",
].join("\n");

/** Shorter text limits for the compact prompt: the subject shows early. */
const COMPACT_LIMITS = { statement: 2_500, support: 1_500, alternative: 300 } as const;

export type PromptStyle = "labelled" | "compact";

function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/** System and user messages sent to the provider, per prompt style. */
export function buildClassificationPrompt(
  input: QuestionClassificationInput,
  taxonomy: TaxonomyIndex,
  style: PromptStyle,
): Readonly<{ system: string; user: string }> {
  if (style === "labelled") {
    const question = [
      truncate(input.statement),
      ...input.supportTexts.map((text) => `Texto de apoio: ${truncate(text)}`),
      ...input.alternatives.map(
        (alternative, index) => `(${String.fromCharCode(65 + index)}) ${truncate(alternative)}`,
      ),
    ].join("\n");

    return {
      system: SYSTEM_PROMPT,
      user: `Taxonomia permitida:\n${describeCandidateTaxonomy(taxonomy, input)}\n\nQuestão:\n${question}`,
    };
  }

  const question = [
    clip(input.statement, COMPACT_LIMITS.statement),
    ...input.supportTexts.map((text) => `Apoio: ${clip(text, COMPACT_LIMITS.support)}`),
    ...input.alternatives.map(
      (alternative, index) => `(${String.fromCharCode(65 + index)}) ${clip(alternative, COMPACT_LIMITS.alternative)}`,
    ),
  ].join("\n");

  return {
    system: COMPACT_SYSTEM_PROMPT,
    user: `Taxonomia:\n${describeCandidateTaxonomyCompact(taxonomy, input)}\n\nQuestão:\n${question}`,
  };
}

const SYSTEM_PROMPT = [
  "Você classifica questões de vestibular/ENEM numa taxonomia fechada.",
  "Use SOMENTE nomes exatamente como aparecem na taxonomia fornecida.",
  "discipline = um nome após DISCIPLINA; area = um nome após ASSUNTO;",
  "topic = um nome após TÓPICO; subtopic = UM único nome da lista SUBTÓPICOS desse tópico (ou null).",
  "Nunca invente disciplina, assunto, tópico ou subtópico.",
  "Se nenhum tópico se aplicar com segurança, retorne topic null e confiança baixa.",
  "Subtópico é opcional: só indique quando claramente aplicável.",
  "Responda apenas com JSON: {\"discipline\",\"area\",\"topic\",\"subtopic\",\"tags\",\"confidence\",\"rationale\"}.",
  "confidence é um número entre 0 e 1. tags: até 5 termos curtos em português.",
].join("\n");

export class OpenAiCompatibleQuestionClassifier implements QuestionClassifier {
  public readonly provider: string;
  public readonly model: string;
  /** Includes the model so switching models re-classifies cleanly. */
  public readonly version: string;

  public constructor(
    private readonly config: OpenAiCompatibleConfig,
    private readonly fetchImpl: FetchLike = fetch,
  ) {
    this.provider = config.providerLabel;
    this.model = config.model;
    this.version = `${this.promptStyle === "labelled" ? "oa-v2" : "oa-v3"}:${config.model}`.slice(0, 40);
  }

  private get promptStyle(): PromptStyle {
    return this.config.promptStyle ?? "compact";
  }

  public async classify(
    input: QuestionClassificationInput,
    taxonomy: TaxonomyIndex,
    options?: ClassifyOptions,
  ): Promise<ProviderClassification> {
    const prompt = buildClassificationPrompt(input, taxonomy, this.promptStyle);

    await options?.beforeRemoteCall?.();

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
              { role: "system", content: prompt.system },
              { role: "user", content: prompt.user },
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
      ...(completion.usage
        ? {
            usage: {
              inputTokens: completion.usage.prompt_tokens ?? 0,
              outputTokens: completion.usage.completion_tokens ?? 0,
            },
          }
        : {}),
    };
  }
}
