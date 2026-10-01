import type {
  ProviderClassification,
  QuestionClassificationInput,
  QuestionClassifier,
} from "../../domain/question-classifier";

import { TfIdfIndex } from "./text-vectors";

/*
 * "Memory" layer of the classification pipeline: it learns from the questions
 * already classified (published ones, reviewed by a person) and answers with no
 * network and no model. Two signals, both inside the Matéria of the question:
 *
 *  - nearest neighbours: a question that looks like a classified one (the same
 *    exam repeated by another board, the same law, the same wording);
 *  - topic centroids: the average vocabulary of each Subtópico, so that a
 *    question that is clearly closer to one Subtópico than to the others gets it.
 *
 * Confidence is calibrated on leave-one-out runs (`classification:calibrate-similar`):
 * 0.90 means about 92-93% of such answers were right. The more questions are
 * classified and published, the more this layer answers and the less AI is needed.
 */

export type ClassifiedExample = Readonly<{
  questionId: string;
  knowledgeAreaId: string | null;
  disciplineId: string | null;
  /** Statement and alternatives (support texts are shared between different topics, so they stay out). */
  text: string;
  discipline: string;
  area: string | null;
  topic: string;
  subtopic: string | null;
}>;

export type SimilarOptions = Readonly<{
  /** Neighbours that vote. */
  neighbours: number;
  /** Ignore neighbours below this cosine similarity. */
  minimumSimilarity: number;
}>;

export const DEFAULT_SIMILAR_OPTIONS: SimilarOptions = { neighbours: 5, minimumSimilarity: 0.25 };

type Path = Readonly<{ discipline: string; area: string | null; topic: string }>;

const topicKey = (path: Pick<Path, "discipline" | "topic">) => `${path.discipline}|${path.topic}`;

export class SimilarQuestionClassifier implements QuestionClassifier {
  public readonly provider = "similar";
  public readonly model = null;
  public readonly version = "similar-v2";

  private readonly index: TfIdfIndex;
  /** Sum of the document vectors of each Subtópico, and how many documents. */
  private readonly sums = new Map<string, Map<string, number>>();
  private readonly counts = new Map<string, number>();
  private readonly squaredNorms = new Map<string, number>();
  private readonly paths = new Map<string, Path & { disciplineId: string | null; knowledgeAreaId: string | null }>();
  private readonly byQuestion = new Map<string, number>();

  public constructor(
    private readonly examples: readonly ClassifiedExample[],
    private readonly options: SimilarOptions = DEFAULT_SIMILAR_OPTIONS,
  ) {
    this.index = new TfIdfIndex(examples.map((example) => example.text));

    // Filled after the sums are complete (below).
    examples.forEach((example, doc) => {
      const key = topicKey(example);
      const sum = this.sums.get(key) ?? new Map<string, number>();

      for (const [term, weight] of this.index.vectors[doc]!) {
        sum.set(term, (sum.get(term) ?? 0) + weight);
      }

      this.sums.set(key, sum);
      this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
      this.paths.set(key, { discipline: example.discipline, area: example.area, topic: example.topic, disciplineId: example.disciplineId, knowledgeAreaId: example.knowledgeAreaId });
      this.byQuestion.set(example.questionId, doc);
    });

    for (const [key, sum] of this.sums) {
      let squared = 0;

      for (const weight of sum.values()) {
        squared += weight * weight;
      }

      this.squaredNorms.set(key, squared);
    }
  }

  public get exampleCount(): number {
    return this.examples.length;
  }

  private inScope(input: QuestionClassificationInput, example: Pick<ClassifiedExample, "disciplineId" | "knowledgeAreaId">): boolean {
    // The Matéria set by the importer narrows the candidates; without it the knowledge area does.
    if (input.disciplineId) {
      return example.disciplineId === input.disciplineId;
    }

    return !input.knowledgeAreaId || example.knowledgeAreaId === input.knowledgeAreaId;
  }

  public async classify(input: QuestionClassificationInput): Promise<ProviderClassification> {
    const none: ProviderClassification = { discipline: null, area: null, topic: null, subtopic: null, tags: [], confidence: 0 };
    const text = [input.statement, ...input.alternatives].join(" ");
    const own = this.byQuestion.get(input.questionId);

    // ---- nearest neighbours
    const ranked: { example: ClassifiedExample; similarity: number }[] = [];

    for (const [doc, similarity] of this.index.similarities(text)) {
      const example = this.examples[doc]!;

      if (similarity >= this.options.minimumSimilarity && doc !== own && this.inScope(input, example)) {
        ranked.push({ example, similarity });
      }
    }

    ranked.sort((left, right) => right.similarity - left.similarity);

    const top = ranked.slice(0, this.options.neighbours);
    const votes = new Map<string, { weight: number; best: (typeof top)[number]; members: typeof top }>();
    let total = 0;

    for (const neighbour of top) {
      const key = topicKey(neighbour.example);
      const weight = neighbour.similarity * neighbour.similarity;
      const vote = votes.get(key) ?? { weight: 0, best: neighbour, members: [] };

      vote.weight += weight;
      vote.members = [...vote.members, neighbour];
      votes.set(key, vote);
      total += weight;
    }

    const knnWinner = [...votes.entries()].sort((left, right) => right[1].weight - left[1].weight)[0];
    // 0.5 similar-and-agreeing was right about 92% of the time.
    const knnConfidence = knnWinner ? Math.min(0.97, 0.67 + 0.5 * (knnWinner[1].best.similarity * (knnWinner[1].weight / total))) : 0;

    // ---- topic centroids (needs at least two Subtópicos with examples in the Matéria)
    const vector = this.index.vectorOf(text);
    const scored: { key: string; similarity: number }[] = [];

    for (const [key, sum] of this.sums) {
      const path = this.paths.get(key)!;

      if (!this.inScope(input, path)) {
        continue;
      }

      // The question itself is not part of what it is compared with:
      // (S - v)·q = S·q - v·q and |S - v|² = |S|² - 2 S·v + |v|².
      const ownVector = own !== undefined && topicKey(this.examples[own]!) === key ? this.index.vectors[own]! : null;
      const count = (this.counts.get(key) ?? 0) - (ownVector ? 1 : 0);

      if (count <= 0) {
        continue;
      }

      let dot = 0;

      for (const [term, weight] of vector) {
        dot += weight * (sum.get(term) ?? 0);
      }

      let squaredNorm = this.squaredNorms.get(key)!;

      if (ownVector) {
        let ownDotSum = 0;
        let ownDotQuery = 0;
        let ownSquared = 0;

        for (const [term, weight] of ownVector) {
          ownDotSum += weight * (sum.get(term) ?? 0);
          ownDotQuery += weight * (vector.get(term) ?? 0);
          ownSquared += weight * weight;
        }

        dot -= ownDotQuery;
        squaredNorm = squaredNorm - 2 * ownDotSum + ownSquared;
      }

      scored.push({ key, similarity: dot / (Math.sqrt(Math.max(squaredNorm, 1e-9)) || 1) });
    }

    scored.sort((left, right) => right.similarity - left.similarity);

    const centroidWinner = scored[0];
    const margin = centroidWinner && scored.length >= 2 ? centroidWinner.similarity - scored[1]!.similarity : 0;
    // margin 0.1 was right about 93% of the time, 0.2 about 97%.
    const centroidConfidence = centroidWinner && scored.length >= 2 ? Math.min(0.97, 0.7 + 2.2 * margin) : 0;

    // ---- decision
    const candidates = [
      knnWinner ? { key: knnWinner[0], confidence: knnConfidence, source: "knn" as const } : null,
      centroidWinner && centroidConfidence > 0 ? { key: centroidWinner.key, confidence: centroidConfidence, source: "centroid" as const } : null,
    ].filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);

    if (candidates.length === 0) {
      return none;
    }

    const best = candidates.sort((left, right) => right.confidence - left.confidence)[0]!;
    const agree = candidates.length === 2 && candidates[0]!.key === candidates[1]!.key;
    const confidence = agree ? Math.min(0.99, best.confidence + 0.03) : best.confidence;
    const path = this.paths.get(best.key)!;

    // A Detalhe only when the nearest neighbours of that Subtópico agree on it and are close.
    const members = votes.get(best.key)?.members ?? [];
    const detail = members[0]?.example.subtopic ?? null;
    const detailAgrees = members.length > 0 && members.every((member) => member.example.subtopic === detail) && members[0]!.similarity >= 0.7;

    return {
      discipline: path.discipline,
      area: path.area,
      topic: path.topic,
      subtopic: detailAgrees ? detail : null,
      tags: [],
      confidence,
      rationale: `Aprendido de questões já classificadas (${agree ? "vizinhas e vocabulário do subtópico concordam" : best.source === "knn" ? "questão parecida" : "vocabulário do subtópico"}).`,
    };
  }
}
