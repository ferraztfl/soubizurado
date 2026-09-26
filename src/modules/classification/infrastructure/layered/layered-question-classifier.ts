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
 *   2. Rules — local keyword/alias matching (no network, no quota).
 *      Accepted when it resolves a Subtópico without blocking issues and
 *      with confidence >= rulesThreshold (CLASSIFIER_RULES_THRESHOLD, 0.8
 *      by default — calibrate with `classification:calibrate-rules`).
 *   3. AI — only when the rules fail or are below the threshold.
 */
export class LayeredQuestionClassifier implements QuestionClassifier {
  public readonly provider: string;
  public readonly model: string | null;
  public readonly version: string;

  public constructor(
    private readonly rules: QuestionClassifier,
    private readonly ai: QuestionClassifier,
    private readonly rulesThreshold: number,
  ) {
    if (!Number.isFinite(rulesThreshold) || rulesThreshold < 0 || rulesThreshold > 1) {
      throw new Error("rulesThreshold must be between 0 and 1.");
    }

    this.provider = `layered:${ai.provider}`.slice(0, 60);
    this.model = ai.model;
    // Fits question_classification_tasks.classifier_version (40 chars).
    this.version = `lay1:${ai.version}`.slice(0, 40);
  }

  public async classify(
    input: QuestionClassificationInput,
    taxonomy: TaxonomyIndex,
    options?: ClassifyOptions,
  ): Promise<ProviderClassification> {
    const byRules = await this.rules.classify(input, taxonomy);
    const resolved = resolveProviderClassification(taxonomy, input, byRules);

    if (resolved.topicId && !hasBlockingIssues(resolved) && resolved.confidence >= this.rulesThreshold) {
      return { ...byRules, layer: "RULES" };
    }

    const byAi = await this.ai.classify(input, taxonomy, options);

    return { ...byAi, layer: "AI" };
  }
}
