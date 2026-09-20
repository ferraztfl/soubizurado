import type {
  QuestionType,
} from "../../domain/question-type";

export type PublicQuestionAlternativeRecord = Readonly<{
  id: string;
  label: string;
  content: string;
  position: number;
}>;

export type PublicQuestionSupportContentRecord =
  Readonly<{
    id: string;
    content: string;
    position: number;
  }>;

export type PublicQuestionTaxonomyReference =
  Readonly<{
    id: string;
    name: string;
  }>;

export type PublicQuestionBoardReference = Readonly<{
  id: string;
  name: string;
  acronym: string | null;
}>;

export type PublicQuestionExaminationReference =
  Readonly<{
    id: string;
    title: string;
    year: number | null;
    board: PublicQuestionBoardReference | null;
  }>;

export type PublicQuestionReadRecord = Readonly<{
  id: string;
  type: QuestionType;
  statement: string;
  supportContents?:
    readonly PublicQuestionSupportContentRecord[];
  alternatives:
    readonly PublicQuestionAlternativeRecord[];
  discipline: PublicQuestionTaxonomyReference;
  area: PublicQuestionTaxonomyReference | null;
  topic: PublicQuestionTaxonomyReference;
  subtopic: PublicQuestionTaxonomyReference | null;
  examination:
    | PublicQuestionExaminationReference
    | null;
}>;

export type PublicQuestionReadFilters = Readonly<{
  search?: string;
  disciplineId?: string;
  areaId?: string;
  topicId?: string;
  subtopicId?: string;
  boardId?: string;
  examinationId?: string;
  year?: number;
  type?: QuestionType;
}>;

export type ListPublicQuestionsRepositoryInput =
  Readonly<{
    filters: PublicQuestionReadFilters;
    offset: number;
    limit: number;
  }>;

export type ListPublicQuestionsRepositoryResult =
  Readonly<{
    items: readonly PublicQuestionReadRecord[];
    total: number;
  }>;

export type QuestionExplorerFacets = Readonly<{
  disciplines: readonly PublicQuestionTaxonomyReference[];
  boards: readonly PublicQuestionBoardReference[];
  years: readonly number[];
  types: readonly QuestionType[];
}>;

export interface PublicQuestionReadRepository {
  listPublished(
    input: ListPublicQuestionsRepositoryInput,
  ): Promise<ListPublicQuestionsRepositoryResult>;

  findPublishedById(
    questionId: string,
  ): Promise<PublicQuestionReadRecord | null>;

  listExplorerFacets(): Promise<QuestionExplorerFacets>;
}
