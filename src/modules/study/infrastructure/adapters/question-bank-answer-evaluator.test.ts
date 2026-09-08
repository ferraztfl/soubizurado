import type {
  SubmitPublishedQuestionAnswerUseCase,
} from "../../../question-bank/application/use-cases/submit-published-question-answer";

import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  QuestionBankAnswerEvaluator,
} from "./question-bank-answer-evaluator";

describe("QuestionBankAnswerEvaluator", () => {
  it("maps question-bank evaluation into the Study contract", async () => {
    const execute = vi.fn().mockResolvedValue({
      questionId: "question-1",
      isCorrect: true,
      selectedAnswer: {
        type: "MULTIPLE_CHOICE",
        alternativeId: "alternative-a",
        label: "A",
        content: "Alternativa A",
      },
      correctAnswer: {
        type: "MULTIPLE_CHOICE",
        alternativeId: "alternative-a",
        label: "A",
        content: "Alternativa A",
      },
      explanation: "Explicacao",
    });

    const questionBankUseCase = {
      execute,
    } as unknown as SubmitPublishedQuestionAnswerUseCase;

    const evaluator = new QuestionBankAnswerEvaluator(
      questionBankUseCase,
    );

    const result = await evaluator.evaluate({
      questionId: "question-1",
      answer: {
        type: "MULTIPLE_CHOICE",
        alternativeId: "alternative-a",
      },
    });

    expect(execute).toHaveBeenCalledWith({
      questionId: "question-1",
      answer: {
        type: "MULTIPLE_CHOICE",
        alternativeId: "alternative-a",
      },
    });

    expect(result).toEqual({
      questionId: "question-1",
      questionType: "MULTIPLE_CHOICE",
      isCorrect: true,
      selectedAnswer: {
        type: "MULTIPLE_CHOICE",
        alternativeId: "alternative-a",
        label: "A",
        content: "Alternativa A",
      },
      correctAnswer: {
        type: "MULTIPLE_CHOICE",
        alternativeId: "alternative-a",
        label: "A",
        content: "Alternativa A",
      },
      explanation: "Explicacao",
    });
  });
});
