import type { QuestionType } from "../../domain/question-type";

export type PublicQuestionMediaDto = Readonly<{
  id: string;
  url: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  altText: string | null;
  position: number;
}>;

export type PublicQuestionAlternativeDto = Readonly<{
  id: string;
  label: string;
  content: string;
  position: number;
  media?: readonly PublicQuestionMediaDto[];
}>;

export type PublicQuestionSupportContentDto = Readonly<{
  id: string;
  content: string;
  position: number;
}>;

export type PublicTaxonomyReferenceDto = Readonly<{
  id: string;
  name: string;
}>;

export type PublicQuestionBoardDto = Readonly<{
  id: string;
  name: string;
  acronym: string | null;
}>;

export type PublicQuestionExaminationDto = Readonly<{
  id: string;
  title: string;
  year: number | null;
  board: PublicQuestionBoardDto | null;
}>;

export type PublicQuestionDto = Readonly<{
  id: string;
  /** Public code, e.g. "Q100001" (URLs, cards, search). */
  code: string;
  type: QuestionType;
  statement: string;

  supportContents:
    readonly PublicQuestionSupportContentDto[];

  media?: readonly PublicQuestionMediaDto[];

  alternatives:
    readonly PublicQuestionAlternativeDto[];

  classification: Readonly<{
    discipline: PublicTaxonomyReferenceDto;
    area: PublicTaxonomyReferenceDto | null;
    topic: PublicTaxonomyReferenceDto;
    subtopic: PublicTaxonomyReferenceDto | null;
  }>;

  examination: PublicQuestionExaminationDto | null;

  /**
   * Imported image source URL → local media URL, for images written inside
   * the statement, support texts or alternatives (pass to RichText). Those
   * images are left out of `media` / alternative `media`.
   */
  textImages: Readonly<Record<string, string>>;
}>;