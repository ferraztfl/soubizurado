import type { QuestionClassifier } from "../domain/question-classifier";

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

    return new OpenAiCompatibleQuestionClassifier({
      baseUrl,
      apiKey: env.CLASSIFIER_API_KEY?.trim() || null,
      model,
      providerLabel: env.CLASSIFIER_PROVIDER_LABEL?.trim() || "openai-compatible",
      timeoutMs,
    });
  }

  throw new Error(`Unknown CLASSIFIER_PROVIDER "${provider}".`);
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
