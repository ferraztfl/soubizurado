import type { QuestionClassifier } from "../domain/question-classifier";

import { type LocalAiLayer, LayeredQuestionClassifier } from "./layered/layered-question-classifier";
import { OpenAiCompatibleQuestionClassifier } from "./openai-compatible/openai-compatible-question-classifier";
import { RuleBasedQuestionClassifier } from "./rule-based/rule-based-question-classifier";

type Environment = Readonly<Record<string, string | undefined>>;

/**
 * Picks the classifier from server-side environment variables:
 *
 *   CLASSIFIER_PROVIDER=rule-based            (default, no network)
 *   CLASSIFIER_PROVIDER=openai-compatible
 *   CLASSIFIER_API_BASE_URL=https://api.openai.com/v1
 *   CLASSIFIER_API_KEY=...                    (optional for local servers)
 *   CLASSIFIER_MODEL=...
 *   CLASSIFIER_PROVIDER_LABEL=openai|gemini|ollama|...
 *   CLASSIFIER_TIMEOUT_MS=30000
 *   CLASSIFIER_PROMPT_STYLE=labelled          (default v2; labelled-short = v4; compact = v3, rejected)
 *   CLASSIFIER_LAYERED=true                   (default: rules first, AI as fallback)
 *   CLASSIFIER_RULES_THRESHOLD=0.8            (rules answer accepted at or above)
 *
 * Optional local AI between the rules and the remote AI (e.g. Ollama):
 *   CLASSIFIER_LOCAL_API_BASE_URL=http://localhost:11434/v1
 *   CLASSIFIER_LOCAL_MODEL=qwen2.5:3b
 *   CLASSIFIER_LOCAL_THRESHOLD=0.9            (stricter: small models overstate confidence)
 *   CLASSIFIER_LOCAL_TIMEOUT_MS=180000        (CPU inference is slow)
 */
export function createQuestionClassifier(
  env: Environment = process.env,
): QuestionClassifier {
  const provider = env.CLASSIFIER_PROVIDER?.trim() || "rule-based";

  if (provider === "rule-based") {
    return new RuleBasedQuestionClassifier();
  }

  if (provider === "openai-compatible") {
    const baseUrl = env.CLASSIFIER_API_BASE_URL?.trim();
    const model = env.CLASSIFIER_MODEL?.trim();

    if (!baseUrl || !model) {
      throw new Error(
        "CLASSIFIER_API_BASE_URL and CLASSIFIER_MODEL are required for openai-compatible.",
      );
    }

    if (!/^https:\/\//.test(baseUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(baseUrl)) {
      throw new Error("CLASSIFIER_API_BASE_URL must use https (http only for localhost).");
    }

    const timeoutMs = Number(env.CLASSIFIER_TIMEOUT_MS ?? "30000");

    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 300_000) {
      throw new Error("CLASSIFIER_TIMEOUT_MS must be between 1000 and 300000.");
    }

    const promptStyle = env.CLASSIFIER_PROMPT_STYLE?.trim() || "labelled";

    if (promptStyle !== "labelled" && promptStyle !== "labelled-short" && promptStyle !== "compact") {
      throw new Error('CLASSIFIER_PROMPT_STYLE must be "labelled", "labelled-short" or "compact".');
    }

    const ai = new OpenAiCompatibleQuestionClassifier({
      baseUrl,
      apiKey: env.CLASSIFIER_API_KEY?.trim() || null,
      model,
      providerLabel: env.CLASSIFIER_PROVIDER_LABEL?.trim() || "openai-compatible",
      timeoutMs,
      promptStyle,
    });

    if (env.CLASSIFIER_LAYERED?.trim().toLowerCase() === "false") {
      return ai;
    }

    return new LayeredQuestionClassifier(
      new RuleBasedQuestionClassifier(),
      ai,
      readRulesThreshold(env),
      createLocalAiLayer(env),
    );
  }

  throw new Error(`Unknown CLASSIFIER_PROVIDER "${provider}".`);
}

function createLocalAiLayer(env: Environment): LocalAiLayer | null {
  const baseUrl = env.CLASSIFIER_LOCAL_API_BASE_URL?.trim();
  const model = env.CLASSIFIER_LOCAL_MODEL?.trim();

  if (!baseUrl || !model) {
    return null;
  }

  // Local means local: never send questions to another host this way.
  if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(baseUrl)) {
    throw new Error("CLASSIFIER_LOCAL_API_BASE_URL must point to localhost.");
  }

  const timeoutMs = Number(env.CLASSIFIER_LOCAL_TIMEOUT_MS ?? "180000");

  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 900_000) {
    throw new Error("CLASSIFIER_LOCAL_TIMEOUT_MS must be between 1000 and 900000.");
  }

  const threshold = Number(env.CLASSIFIER_LOCAL_THRESHOLD ?? "0.9");

  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new Error("CLASSIFIER_LOCAL_THRESHOLD must be between 0 and 1.");
  }

  return {
    classifier: new OpenAiCompatibleQuestionClassifier({
      baseUrl,
      apiKey: null,
      model,
      providerLabel: "ollama",
      timeoutMs,
    }),
    threshold,
  };
}

export function readRulesThreshold(
  env: Environment = process.env,
): number {
  // Same as the auto-apply threshold by default: a rules answer below it
  // would neither be applied nor reach the AI (measured on 2026-09-26: a
  // 0.625 rules answer sent a Vargas-era History question to Geography).
  const value = Number(env.CLASSIFIER_RULES_THRESHOLD ?? "0.8");

  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error("CLASSIFIER_RULES_THRESHOLD must be between 0 and 1.");
  }

  return value;
}

/** Auto-apply COMPLETED suggestions (default on; set to "false" to only suggest). */
export function readAutoApply(
  env: Environment = process.env,
): boolean {
  return env.CLASSIFIER_AUTO_APPLY?.trim().toLowerCase() !== "false";
}

export function readMinimumConfidence(
  env: Environment = process.env,
): number {
  const value = Number(env.CLASSIFIER_MIN_CONFIDENCE ?? "0.8");

  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error("CLASSIFIER_MIN_CONFIDENCE must be between 0 and 1.");
  }

  return value;
}
