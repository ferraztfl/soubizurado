export type ProviderQuestionAlternative =
  Readonly<{
    label: string;
    contentHtml: string;
    imageUrls: readonly string[];
  }>;

export type ProviderQuestionCandidate =
  Readonly<{
    externalId: string;
    number: string | null;
    statementHtml: string;
    alternatives:
      readonly ProviderQuestionAlternative[];
    answerKey: string | null;
    examinationExternalIds:
      readonly string[];
    discipline: string | null;
    topic: string | null;
    supportTextsHtml: readonly string[];
    attachmentUrls: readonly string[];
    hasImages: boolean;
    hasAnswerKey: boolean;
    hasSupportText: boolean;
    sourceUrl?: string | null;
    rawPayload: unknown;
  }>;

export type QuestionProviderListInput =
  Readonly<{
    limit: number;
    externalId?: string;
    examinationId?: string;
    afterId?: string;
    includeAnswerKey?: boolean;
    requireAnswerKey?: boolean;
    filters?: Readonly<{
      board?: string;
      year?: string;
      discipline?: string;
      topic?: string;
      alternativeType?:
        | "MULTIPLA_ESCOLHA"
        | "CERTO_ERRADO";
      hasAttachments?: boolean;
    }>;
  }>;

export type QuestionProviderListResult =
  Readonly<{
    total: number;
    nextCursor: string | null;
    correlationId: string | null;
    items:
      readonly ProviderQuestionCandidate[];
  }>;

export type ProviderExaminationMetadata =
  Readonly<{
    externalId: string;
    title?: string | null;
    organization: string | null;
    careerPosition: string | null;
    year: number | null;
    board: string | null;
    alternativeType:
      | "MULTIPLA_ESCOLHA"
      | "CERTO_ERRADO"
      | null;
  }>;

export interface QuestionProvider {
  listQuestions(
    input: QuestionProviderListInput,
  ): Promise<QuestionProviderListResult>;

  getExamination(
    externalId: string,
  ): Promise<ProviderExaminationMetadata | null>;
}
