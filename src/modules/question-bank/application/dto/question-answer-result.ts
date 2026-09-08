export type MultipleChoiceAnswerDto = Readonly<{
  type: "MULTIPLE_CHOICE";
  alternativeId: string;
  label: string;
  content: string;
}>;

export type TrueFalseAnswerDto = Readonly<{
  type: "TRUE_FALSE";
  value: boolean;
}>;

export type QuestionAnswerDto =
  | MultipleChoiceAnswerDto
  | TrueFalseAnswerDto;

export type QuestionAnswerResultDto = Readonly<{
  questionId: string;
  isCorrect: boolean;
  selectedAnswer: QuestionAnswerDto;
  correctAnswer: QuestionAnswerDto;
  explanation: string | null;
}>;
