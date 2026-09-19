export type StudyIncorrectQuestionRecord = Readonly<{
  questionId: string;
  lastIncorrectAt: Date;
  incorrectAttempts: number;
}>;

export type ListStudyIncorrectQuestionsRepositoryInput =
  Readonly<{
    profileId: string;
    offset: number;
    limit: number;
  }>;

export type ListStudyIncorrectQuestionsRepositoryResult =
  Readonly<{
    items: readonly StudyIncorrectQuestionRecord[];
    total: number;
  }>;

export interface StudyIncorrectQuestionsRepository {
  listIncorrectQuestions(
    input: ListStudyIncorrectQuestionsRepositoryInput,
  ): Promise<ListStudyIncorrectQuestionsRepositoryResult>;
}
