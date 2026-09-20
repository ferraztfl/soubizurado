import type {
  ProviderExaminationMetadata,
} from "./question-provider";

export type ImportedQuestionType =
  | "MULTIPLE_CHOICE"
  | "TRUE_FALSE";

export type ImportedQuestionStatus =
  | "IN_REVIEW"
  | "PUBLISHED";

export type ImportedAnswerKeyStatus =
  | "DEFINED"
  | "VERIFIED";

export type ImportedMediaRole =
  | "QUESTION_ATTACHMENT"
  | "ALTERNATIVE_IMAGE";

export type PersistImportedMediaInput =
  Readonly<{
    sourceUrl: string;
    role: ImportedMediaRole;
    alternativeLabel: string;
    position: number;
  }>;

export type EnqueueImportedMediaInput =
  Readonly<{
    jobId: string;
    externalId: string;
    questionId: string | null;
    media:
      readonly PersistImportedMediaInput[];
  }>;

export type PersistImportedQuestionInput =
  Readonly<{
    jobId: string;
    sourceId: string;
    externalId: string;
    externalQuestionNumber:
      | string
      | null;
    externalExaminationId:
      | string
      | null;
    sourceUrl: string | null;
    rawPayload: unknown;
    payloadHash: string;
    canonicalFingerprint: string;
    normalizationVersion: number;
    contentHash: string;
    type: ImportedQuestionType;
    status: ImportedQuestionStatus;
    answerKeyStatus:
      ImportedAnswerKeyStatus;
    statement: string;
    alternatives: readonly Readonly<{
      label: string;
      content: string;
      position: number;
      isCorrect: boolean;
    }>[];
    correctTrueFalse: boolean | null;
    disciplineName: string;
    topicName: string | null;
    supportContents: readonly Readonly<{
      content: string;
      contentHash: string;
      position: number;
    }>[];
    media:
      readonly PersistImportedMediaInput[];
    examination:
      | ProviderExaminationMetadata
      | null;
  }>;

export type PersistImportedQuestionResult =
  Readonly<
    | {
        status: "IMPORTED";
        questionId: string;
      }
    | {
        status: "DUPLICATE";
        questionId: string;
      }
    | {
        status: "REVIEW_REQUIRED";
        questionId: string | null;
        reason: string;
      }
  >;

export type RecordImportReviewInput =
  Readonly<{
    jobId: string;
    externalId: string;
    rawPayload: unknown;
    payloadHash: string;
    reason: string;
  }>;

export type ImportJobCounts = Readonly<{
  received: number;
  imported: number;
  duplicates: number;
  reviewRequired: number;
  failed: number;
}>;

export interface QuestionImportRepository {
  ensureSource(): Promise<Readonly<{
    id: string;
  }>>;

  createJob(
    input: Readonly<{
      sourceId: string;
      requestedLimit: number;
      cursorStart: string | null;
    }>,
  ): Promise<Readonly<{
    id: string;
  }>>;

  persistQuestion(
    input: PersistImportedQuestionInput,
  ): Promise<PersistImportedQuestionResult>;

  enqueueMedia(
    input: EnqueueImportedMediaInput,
  ): Promise<void>;

  recordReview(
    input: RecordImportReviewInput,
  ): Promise<void>;

  recordFailure(
    input: RecordImportReviewInput,
  ): Promise<void>;

  completeJob(
    input: Readonly<{
      jobId: string;
      cursorEnd: string | null;
      counts: ImportJobCounts;
    }>,
  ): Promise<void>;

  failJob(
    input: Readonly<{
      jobId: string;
      message: string;
    }>,
  ): Promise<void>;
}
