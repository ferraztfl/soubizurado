import type {
  SubmitPublishedQuestionAnswerUseCase,
} from "../../../question-bank/application/use-cases/submit-published-question-answer";

import type {
  EvaluateStudyQuestionAnswerInput,
  QuestionAnswerEvaluator,
  StudyQuestionAnswerEvaluation,
} from "../../application/ports/question-answer-evaluator";

export class QuestionBankAnswerEvaluator
  implements QuestionAnswerEvaluator
{
  public constructor(
    private readonly submitPublishedQuestionAnswer:
      SubmitPublishedQuestionAnswerUseCase,
  ) {}

  public async evaluate(
    input: EvaluateStudyQuestionAnswerInput,
  ): Promise<StudyQuestionAnswerEvaluation> {
    const result =
      input.answer.type === "MULTIPLE_CHOICE"
        ? await this.submitPublishedQuestionAnswer.execute({
            questionId: input.questionId,
            answer: {
              type: "MULTIPLE_CHOICE",
              alternativeId: input.answer.alternativeId,
            },
          })
        : await this.submitPublishedQuestionAnswer.execute({
            questionId: input.questionId,
            answer: {
              type: "TRUE_FALSE",
              value: input.answer.value,
            },
          });

    return {
      questionId: result.questionId,
      questionType: result.selectedAnswer.type,
      isCorrect: result.isCorrect,
      selectedAnswer: result.selectedAnswer,
      correctAnswer: result.correctAnswer,
      explanation: result.explanation,
    };
  }
}
