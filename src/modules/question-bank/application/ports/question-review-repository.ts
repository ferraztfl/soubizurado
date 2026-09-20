import type {
  QuestionType,
} from "../../domain/question-type";

export type ReviewTaxonomyReference =
  Readonly<{
    id: string;
    name: string;
  }>;


export type ReviewQuestionOccurrence =
  Readonly<{
    id: string;
    sourceName: string;
    externalQuestionNumber: string | null;
    examination: Readonly<{
      id: string;
      title: string;
      year: number | null;
      board: string | null;
      organization: string | null;
      careerPosition: string | null;
    }> | null;
  }>;

export type ReviewQuestionListItem =
  Readonly<{
    id: string;
    type: QuestionType;
    statement: string;
    answerKeyStatus:
      | "MISSING"
      | "DEFINED"
      | "VERIFIED";
    discipline:
      | ReviewTaxonomyReference
      | null;
    topic:
      | ReviewTaxonomyReference
      | null;
    occurrences:
      readonly ReviewQuestionOccurrence[];
    updatedAt: Date;
  }>;

export type ReviewPublicationCandidate =
  Readonly<{
    id: string;
    type: QuestionType;
    statement: string;
    sourceId: string | null;
    disciplineId: string | null;
    topicId: string | null;
    correctTrueFalse: boolean | null;
    alternatives: readonly Readonly<{
      content: string;
      isCorrect: boolean;
    }>[];
  }>;

export interface QuestionReviewRepository {
  listInReview(): Promise<
    readonly ReviewQuestionListItem[]
  >;

  assignTopic(
    input: Readonly<{
      questionId: string;
      topicName: string;
    }>,
  ): Promise<ReviewTaxonomyReference | null>;

  findPublicationCandidate(
    questionId: string,
  ): Promise<ReviewPublicationCandidate | null>;

  publishQuestion(
    questionId: string,
  ): Promise<boolean>;
}
