export type StudySubmittedAnswer =
  | Readonly<{
      type: "MULTIPLE_CHOICE";
      alternativeId: string;
    }>
  | Readonly<{
      type: "TRUE_FALSE";
      value: boolean;
    }>;

export type StudyAnswerDisplay =
  | Readonly<{
      type: "MULTIPLE_CHOICE";
      alternativeId: string;
      label: string;
      content: string;
    }>
  | Readonly<{
      type: "TRUE_FALSE";
      value: boolean;
    }>;

export type StudyQuestionAnswerEvaluation = Readonly<{
  questionId: string;
  questionType: StudySubmittedAnswer["type"];
  isCorrect: boolean;
  selectedAnswer: StudyAnswerDisplay;
  correctAnswer: StudyAnswerDisplay;
  explanation: string | null;
}>;

export type EvaluateStudyQuestionAnswerInput = Readonly<{
  questionId: string;
  answer: StudySubmittedAnswer;
}>;

export interface QuestionAnswerEvaluator {
  evaluate(
    input: EvaluateStudyQuestionAnswerInput,
  ): Promise<StudyQuestionAnswerEvaluation>;
}
