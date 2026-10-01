import { normalizeTaxonomyTerm } from "@/modules/taxonomy/domain/taxonomy-term";

/*
 * Sparse TF-IDF vectors over words and word pairs, used to find questions
 * that are similar to an already classified one (no network, no model).
 */

const STOPWORDS = new Set(
  (
    "a o as os um uma uns umas de da do das dos em no na nos nas por para com sem sob sobre entre ate apos " +
    "e ou mas que se como quando onde qual quais quem cujo cuja cujos cujas seu sua seus suas ele ela eles elas " +
    "foi sao era ser ter tem ha mais menos muito pouco ja nao sim ao aos pela pelo pelas pelos isso isto esse essa " +
    "esses essas este esta estes estas aquele aquela alternativa alternativas assinale correta correto incorreta " +
    "incorreto afirmar texto trecho excerto acordo respeito seguinte seguintes item itens"
  ).split(" "),
);

/** Words (accents and case folded) without stopwords, plus consecutive pairs. */
export function tokenize(text: string): string[] {
  const words = normalizeTaxonomyTerm(text)
    .split(" ")
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word) && !/^[0-9]{1,2}$/.test(word));
  const pairs: string[] = [];

  for (let index = 0; index + 1 < words.length; index += 1) {
    pairs.push(`${words[index]}_${words[index + 1]}`);
  }

  return [...words, ...pairs];
}

export type SparseVector = ReadonlyMap<string, number>;

export class TfIdfIndex {
  private readonly idf = new Map<string, number>();
  private readonly postings = new Map<string, { doc: number; weight: number }[]>();
  public readonly size: number;
  /** Weights of every indexed document (same order as the constructor input). */
  public readonly vectors: ReadonlyMap<string, number>[] = [];

  public constructor(documents: readonly string[]) {
    this.size = documents.length;
    const tokenized = documents.map(tokenize);
    const df = new Map<string, number>();

    for (const tokens of tokenized) {
      for (const token of new Set(tokens)) {
        df.set(token, (df.get(token) ?? 0) + 1);
      }
    }

    for (const [token, count] of df) {
      this.idf.set(token, Math.log((this.size + 1) / (count + 1)) + 1);
    }

    tokenized.forEach((tokens, doc) => {
      const weights = this.weigh(tokens);

      this.vectors.push(weights);

      for (const [token, weight] of weights) {
        const list = this.postings.get(token) ?? [];

        list.push({ doc, weight });
        this.postings.set(token, list);
      }
    });
  }

  /** L2-normalized TF-IDF weights; terms never seen in the corpus are ignored. */
  private weigh(tokens: readonly string[]): Map<string, number> {
    const counts = new Map<string, number>();

    for (const token of tokens) {
      if (this.idf.has(token)) {
        counts.set(token, (counts.get(token) ?? 0) + 1);
      }
    }

    let norm = 0;
    const weights = new Map<string, number>();

    for (const [token, count] of counts) {
      const weight = (1 + Math.log(count)) * this.idf.get(token)!;

      weights.set(token, weight);
      norm += weight * weight;
    }

    norm = Math.sqrt(norm) || 1;

    for (const [token, weight] of weights) {
      weights.set(token, weight / norm);
    }

    return weights;
  }

  /** Weights of any text in this index's space. */
  public vectorOf(text: string): ReadonlyMap<string, number> {
    return this.weigh(tokenize(text));
  }

  /** Cosine similarity of the text with every document that shares a term (document index → score). */
  public similarities(text: string): Map<number, number> {
    const scores = new Map<number, number>();

    for (const [token, weight] of this.weigh(tokenize(text))) {
      for (const posting of this.postings.get(token) ?? []) {
        scores.set(posting.doc, (scores.get(posting.doc) ?? 0) + weight * posting.weight);
      }
    }

    return scores;
  }
}
