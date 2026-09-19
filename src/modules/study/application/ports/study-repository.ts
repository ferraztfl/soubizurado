import type {
  QuestionType,
} from "../../../question-bank/domain/question-type";

export type CreateStudyAnswerAttemptInput = Readonly<{
  profileId: string;
  questionId: string;
  questionType: QuestionType;
  selectedAlternativeId: string | null;
  selectedTrueFalse: boolean | null;
  isCorrect: boolean;
  responseTimeMs: number | null;
}>;

export type StudyAnswerAttemptRecord = Readonly<{
  id: string;
  profileId: string;
  questionId: string;
  questionType: QuestionType;
  selectedAlternativeId: string | null;
  selectedTrueFalse: boolean | null;
  isCorrect: boolean;
  responseTimeMs: number | null;
  answeredAt: Date;
}>;

export interface StudyRepository {
  createAnswerAttempt(
    input: CreateStudyAnswerAttemptInput,
  ): Promise<StudyAnswerAttemptRecord>;
}
