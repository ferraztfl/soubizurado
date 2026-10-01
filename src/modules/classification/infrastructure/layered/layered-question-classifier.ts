import type {
  ClassifyOptions,
  ProviderClassification,
  QuestionClassificationInput,
  QuestionClassifier,
} from "../../domain/question-classifier";
import {
  hasBlockingIssues,
  resolveProviderClassification,
} from "../../domain/resolve-classification";
import type { TaxonomyIndex } from "../../domain/taxonomy-index";

/*
 * Classification pipeline in layers, cheapest first:
 *
 *   1. Metadata — handled before this class: importers set the Matéria
 *      (booklet section) or the full classification. The Matéria narrows
 *      the candidates of every later layer; questions that already have
 *      a Subtópico are never enqueued.
 *   2. Rules — local keyword/alias/legal-reference matching (no network,
 *      no quota). Accepted when it resolves a Subtópico without blocking
 *      issues and with confidence >= rulesThreshold
 *      (CLASSIFIER_RULES_THRESHOLD, 0.8 by default — calibrate with
 *      `classification:calibrate-rules`).
 *   2b. Similar questions — what was learned from the questions already
 *      classified and published (see similar/): nearest neighbours and topic
 *      vocabulary, calibrated; no network, no model. Accepted at its own
 *      threshold (CLASSIFIER_SIMILAR_THRESHOLD).
 *   3. Optional local AI (e.g. Ollama) — accepted at or above its own,
 *      stricter threshold; an unreachable or failing local model is
 *      skipped, never fatal.
 *   4. Remote AI — last resort; the only layer that consumes the
 *      provider rate limit (beforeRemoteCall).
 */

export type LocalAiLayer = Readonly<{
  classifier: QuestionClassifier;
  threshold: number;
}>;

function assertThreshold(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be between 0 and 1.`);
  }
}

export class LayeredQuestionClassifier implements QuestionClassifier {
  public readonly provider: string;
  public readonly model: string | null;
  public readonly version: string;

  public constructor(
    private readonly rules: QuestionClassifier,
    private readonly ai: QuestionClassifier,
    private readonly rulesThreshold: number,
    private readonly localAi: LocalAiLayer | null = null,
    private readonly similar: LocalAiLayer | null = null,
  ) {
    assertThreshold("rulesThreshold", rulesThreshold);

    if (similar) {
      assertThreshold("similar threshold", similar.threshold);
    }

    if (localAi) {
      assertThreshold("local AI threshold", localAi.threshold);
    }

    this.provider = `layered:${ai.provider}`.slice(0, 60);
    this.model = ai.model;
    // Fits question_classification_tasks.classifier_version (40 chars).
    // "lay1" is kept for rules → remote AI so existing tasks stay valid.
    // "lay3"/"lay4" add the similar-questions layer (a different version, so tasks are enqueued again).
    this.version = localAi
      ? `lay${similar ? 4 : 2}:${localAi.classifier.model ?? localAi.classifier.version}>${ai.model ?? ai.version}`.slice(0, 40)
      : `lay${similar ? 3 : 1}:${ai.version}`.slice(0, 40);
  }

  private accepts(
    result: ProviderClassification,
    input: QuestionClassificationInput,
    taxonomy: TaxonomyIndex,
    threshold: number,
  ): boolean {
    const resolved = resolveProviderClassification(taxonomy, input, result);

    return Boolean(resolved.topicId) && !hasBlockingIssues(resolved) && resolved.confidence >= threshold;
  }

  public async classify(
    input: QuestionClassificationInput,
    taxonomy: TaxonomyIndex,
    options?: ClassifyOptions,
  ): Promise<ProviderClassification> {
    const byRules = await this.rules.classify(input, taxonomy);

    if (this.accepts(byRules, input, taxonomy, this.rulesThreshold)) {
      return { ...byRules, layer: "RULES" };
    }

    if (this.similar) {
      try {
        const bySimilar = await this.similar.classifier.classify(input, taxonomy);

        if (this.accepts(bySimilar, input, taxonomy, this.similar.threshold)) {
          return { ...bySimilar, layer: "SIMILAR" };
        }
      } catch {
        // Nothing learned yet or a loading problem: the next layers decide.
      }
    }

    if (this.localAi) {
      try {
        // Local calls do not consume the remote rate limit.
        const byLocal = await this.localAi.classifier.classify(input, taxonomy);

        if (this.accepts(byLocal, input, taxonomy, this.localAi.threshold)) {
          return { ...byLocal, layer: "LOCAL_AI" };
        }
      } catch {
        // Local model offline, slow or malformed: fall through to remote.
      }
    }

    const byAi = await this.ai.classify(input, taxonomy, options);

    return { ...byAi, layer: "AI" };
  }
}
