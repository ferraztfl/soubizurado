import type {
  QuestionType,
} from "../../domain/question-type";

export type QuestionAnswerKeyStatus =
  | "MISSING"
  | "DEFINED"
  | "VERIFIED";

export type QuestionAlternativeRecord = Readonly<{
  id: string;
  label: string;
  content: string;
  position: number;
  isCorrect: boolean;
}>;

export type QuestionTaxonomyReference = Readonly<{
  id: string;
  name: string;
}>;

export type QuestionBoardReference = Readonly<{
  id: string;
  name: string;
  acronym: string | null;
}>;

export type QuestionExaminationReference =
  Readonly<{
    id: string;
    title: string;
    year: number | null;
    board: QuestionBoardReference | null;
  }>;

export type PublishedQuestionRecord = Readonly<{
  id: string;
  type: QuestionType;
  statement: string;

  answerKeyStatus: QuestionAnswerKeyStatus;
  correctTrueFalse: boolean | null;
  explanation: string | null;

  alternatives:
    readonly QuestionAlternativeRecord[];

  discipline: QuestionTaxonomyReference;
  area: QuestionTaxonomyReference | null;
  topic: QuestionTaxonomyReference;
  subtopic: QuestionTaxonomyReference | null;

  examination:
    | QuestionExaminationReference
    | null;
}>;

export interface QuestionRepository {
  findPublishedById(
    questionId: string,
  ): Promise<PublishedQuestionRecord | null>;
}
