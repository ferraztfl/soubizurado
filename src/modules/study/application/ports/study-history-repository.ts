import type {
  StudyAnswerAttemptRecord,
} from "./study-repository";

export type ListStudyAnswerAttemptsRepositoryInput =
  Readonly<{
    profileId: string;
    offset: number;
    limit: number;
    isCorrect?: boolean;
  }>;

export type ListStudyAnswerAttemptsRepositoryResult =
  Readonly<{
    items: readonly StudyAnswerAttemptRecord[];
    total: number;
  }>;

export interface StudyHistoryRepository {
  listAnswerAttempts(
    input: ListStudyAnswerAttemptsRepositoryInput,
  ): Promise<ListStudyAnswerAttemptsRepositoryResult>;
}
