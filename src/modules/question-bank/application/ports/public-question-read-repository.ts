import type {
  QuestionType,
} from "../../domain/question-type";

export type PublicQuestionMediaRecord = Readonly<{
  id: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  altText: string | null;
  position: number;
}>;

export type PublicQuestionAlternativeRecord = Readonly<{
  id: string;
  label: string;
  content: string;
  position: number;
  media?: readonly PublicQuestionMediaRecord[];
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
  /** Sequential public number, shown as the code "Q" + number. */
  publicNumber: number;
  type: QuestionType;
  statement: string;

  supportContents?:
    readonly PublicQuestionSupportContentRecord[];

  media?: readonly PublicQuestionMediaRecord[];

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
  organizationId?: string;
  careerPositionId?: string;
  examinationId?: string;
  year?: number;
  type?: QuestionType;
  /** "Minhas questões": questions this profile has / has not answered. */
  answered?: PublicQuestionAnsweredFilter;
}>;

export const PUBLIC_QUESTION_ANSWERED_STATUSES = ["unanswered", "wrong", "correct"] as const;
export type PublicQuestionAnsweredStatus = (typeof PUBLIC_QUESTION_ANSWERED_STATUSES)[number];

/**
 * unanswered: no attempt yet; wrong / correct: at least one wrong / right
 * attempt (a question answered both ways appears in both).
 */
export type PublicQuestionAnsweredFilter = Readonly<{
  profileId: string;
  status: PublicQuestionAnsweredStatus;
}>;

/** recent: latest published first; oldest: by code; year: exam year, newest first. */
export type PublicQuestionSort = "recent" | "oldest" | "year";

export type ListPublicQuestionsRepositoryInput =
  Readonly<{
    filters: PublicQuestionReadFilters;
    offset: number;
    limit: number;
    sort?: PublicQuestionSort;
  }>;

export type ListPublicQuestionsRepositoryResult =
  Readonly<{
    items: readonly PublicQuestionReadRecord[];
    total: number;
  }>;

export type QuestionExplorerAreaFacet = PublicQuestionTaxonomyReference &
  Readonly<{ disciplineId: string }>;

export type QuestionExplorerTopicFacet = PublicQuestionTaxonomyReference &
  Readonly<{ areaId: string }>;

export type QuestionExplorerOrganizationFacet = PublicQuestionTaxonomyReference &
  Readonly<{ acronym: string | null }>;

export type QuestionExplorerFacets = Readonly<{
  disciplines: readonly PublicQuestionTaxonomyReference[];
  /** Tópicos (areas) and subtópicos (topics) with published questions, for the cascade. */
  areas: readonly QuestionExplorerAreaFacet[];
  topics: readonly QuestionExplorerTopicFacet[];
  organizations: readonly QuestionExplorerOrganizationFacet[];
  careerPositions: readonly PublicQuestionTaxonomyReference[];
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