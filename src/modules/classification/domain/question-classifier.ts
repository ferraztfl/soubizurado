import type { TaxonomyIndex } from "./taxonomy-index";

/** Question content given to a classifier. Text only for now. */
export type QuestionClassificationInput = Readonly<{
  questionId: string;
  statement: string;
  supportTexts: readonly string[];
  alternatives: readonly string[];
  /** Constrains candidate disciplines when known (ENEM area). */
  knowledgeAreaId: string | null;
  /**
   * Current canonical discipline, when the question already has one.
   * Legacy ENEM "disciplines" are passed as null.
   */
  disciplineId: string | null;
}>;

/**
 * What a provider returns: names from the taxonomy it was shown, never
 * ids. The backend resolves names to canonical ids and ignores
 * anything that does not exist.
 */
export type ProviderClassification = Readonly<{
  discipline: string | null;
  area: string | null;
  topic: string | null;
  subtopic: string | null;
  tags: readonly string[];
  /** 0..1 as reported/estimated by the provider. */
  confidence: number;
  rationale?: string;
}>;

/**
 * Vendor-neutral classifier port. Implementations may be rule based,
 * local models or remote APIs; choosing one is infrastructure.
 */
export interface QuestionClassifier {
  readonly provider: string;
  readonly model: string | null;
  /** Bump when prompts, rules or keywords change. */
  readonly version: string;

  classify(
    input: QuestionClassificationInput,
    taxonomy: TaxonomyIndex,
  ): Promise<ProviderClassification>;
}
