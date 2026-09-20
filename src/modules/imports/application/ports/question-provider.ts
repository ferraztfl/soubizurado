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
    rawPayload: unknown;
  }>;

export type QuestionProviderListInput =
  Readonly<{
    limit: number;
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

export interface QuestionProvider {
  listQuestions(
    input: QuestionProviderListInput,
  ): Promise<QuestionProviderListResult>;
}
