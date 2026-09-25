import { normalizeTaxonomyTerm } from "@/modules/taxonomy/domain/taxonomy-term";

import type {
  ProviderClassification,
  QuestionClassificationInput,
  QuestionClassifier,
} from "../../domain/question-classifier";
import type {
  IndexedDiscipline,
  IndexedTopic,
  TaxonomyIndex,
} from "../../domain/taxonomy-index";

import { DISCIPLINE_KEYWORDS } from "./discipline-keywords";

/*
 * Deterministic baseline classifier. No network, no model: phrase
 * matching of curated discipline keywords and of the taxonomy's own
 * topic/subtopic names and aliases. Its confidence is deliberately
 * conservative; it exists so the pipeline works without AI and as a
 * fallback, not as the final source of truth.
 */

const MAX_CONFIDENCE = 0.9;
const TOPIC_NAME_WEIGHT = 3;
const SUBTOPIC_NAME_WEIGHT = 2;
const KEYWORD_WEIGHT = 1;
/** Topic score needed before the result is considered saturated. */
const SATURATION_SCORE = 6;

/** Very light pt-BR plural folding, applied to text and terms alike. */
function stemWord(word: string): string {
  if (word.length <= 3) {
    return word;
  }

  if (word.endsWith("oes") || word.endsWith("aes")) {
    return `${word.slice(0, -3)}ao`;
  }

  if (word.endsWith("ais")) {
    return `${word.slice(0, -3)}al`;
  }

  if (word.endsWith("eis")) {
    return `${word.slice(0, -3)}el`;
  }

  // resistores -> resistor, luzes -> luz, males -> mal
  if (/[rzl]es$/.test(word)) {
    return word.slice(0, -2);
  }

  if (word.endsWith("s") && !word.endsWith("ss")) {
    return word.slice(0, -1);
  }

  return word;
}

export function toMatchableText(value: string): string {
  const words = normalizeTaxonomyTerm(value)
    .split(" ")
    .filter(Boolean)
    .map(stemWord);

  return ` ${words.join(" ")} `;
}

function containsTerm(text: string, term: string): boolean {
  const matchable = toMatchableText(term);

  return matchable.trim().length > 0 && text.includes(matchable);
}

function countTerms(text: string, terms: readonly string[]): number {
  return new Set(terms.filter((term) => containsTerm(text, term))).size;
}

type TopicScore = Readonly<{
  topic: IndexedTopic;
  score: number;
  subtopicName: string | null;
}>;

function scoreTopics(
  text: string,
  discipline: IndexedDiscipline,
): TopicScore[] {
  return discipline.topics
    .map((topic) => {
      let bestSubtopic: Readonly<{ name: string; hits: number }> | null = null;

      for (const subtopic of topic.subtopics) {
        const hits = countTerms(text, subtopic.terms);

        if (hits > 0 && (!bestSubtopic || hits > bestSubtopic.hits)) {
          bestSubtopic = { name: subtopic.name, hits };
        }
      }

      const topicHits = countTerms(text, topic.terms);
      const subtopicHits = topic.subtopics.reduce(
        (sum, subtopic) => sum + countTerms(text, subtopic.terms),
        0,
      );

      return {
        topic,
        score:
          topicHits * TOPIC_NAME_WEIGHT +
          subtopicHits * SUBTOPIC_NAME_WEIGHT,
        subtopicName: bestSubtopic?.name ?? null,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);
}

function dominance(scores: readonly number[]): number {
  const total = scores.reduce((sum, score) => sum + score, 0);

  return total > 0 ? (scores[0] ?? 0) / total : 0;
}

export class RuleBasedQuestionClassifier implements QuestionClassifier {
  public readonly provider = "rule-based";
  public readonly model = null;
  public readonly version = "rule-based-v1";

  public async classify(
    input: QuestionClassificationInput,
    taxonomy: TaxonomyIndex,
  ): Promise<ProviderClassification> {
    const text = toMatchableText(
      [input.statement, ...input.supportTexts, ...input.alternatives].join(" "),
    );

    const candidates = taxonomy.candidateDisciplines(input);

    const disciplineScores = candidates
      .map((discipline) => {
        const keywordHits = countTerms(
          text,
          DISCIPLINE_KEYWORDS[discipline.slug] ?? [],
        );
        const topics = scoreTopics(text, discipline);

        return {
          discipline,
          topics,
          score:
            keywordHits * KEYWORD_WEIGHT +
            topics.reduce((sum, entry) => sum + entry.score, 0),
        };
      })
      .sort((left, right) => right.score - left.score);

    const best = disciplineScores[0];

    if (!best || best.score === 0) {
      return {
        discipline: null,
        area: null,
        topic: null,
        subtopic: null,
        tags: [],
        confidence: 0,
        rationale: "Nenhum sinal de disciplina ou tópico encontrado.",
      };
    }

    const disciplineDominance =
      candidates.length === 1
        ? 1
        : dominance(disciplineScores.map((entry) => entry.score));

    const bestTopic = best.topics[0];

    if (!bestTopic) {
      return {
        discipline: best.discipline.name,
        area: null,
        topic: null,
        subtopic: null,
        tags: [],
        confidence: Math.min(MAX_CONFIDENCE, disciplineDominance * 0.5),
        rationale: "Disciplina identificada por palavras-chave; nenhum tópico reconhecido.",
      };
    }

    const topicDominance = dominance(best.topics.map((entry) => entry.score));
    const saturation = Math.min(1, bestTopic.score / SATURATION_SCORE);

    return {
      discipline: best.discipline.name,
      area: bestTopic.topic.areaName,
      topic: bestTopic.topic.name,
      subtopic: bestTopic.subtopicName,
      tags: [],
      confidence: Math.min(
        MAX_CONFIDENCE,
        disciplineDominance * topicDominance * saturation,
      ),
      rationale: `Pontuação do tópico ${bestTopic.score} (dominância ${topicDominance.toFixed(2)}); disciplina com dominância ${disciplineDominance.toFixed(2)}.`,
    };
  }
}
