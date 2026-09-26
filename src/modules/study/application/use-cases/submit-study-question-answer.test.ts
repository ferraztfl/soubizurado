import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  EvaluateStudyQuestionAnswerInput,
  QuestionAnswerEvaluator,
  StudyQuestionAnswerEvaluation,
} from "../ports/question-answer-evaluator";
import type {
  CreateStudyAnswerAttemptInput,
  StudyAnswerAttemptRecord,
  StudyRepository,
} from "../ports/study-repository";
import {
  SubmitStudyQuestionAnswerUseCase,
} from "./submit-study-question-answer";

class FakeQuestionAnswerEvaluator
  implements QuestionAnswerEvaluator
{
  public lastInput:
    | EvaluateStudyQuestionAnswerInput
    | null = null;

  public result: StudyQuestionAnswerEvaluation = {
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
    explanation: "A alternativa A esta correta.",
  };

  public async evaluate(
    input: EvaluateStudyQuestionAnswerInput,
  ): Promise<StudyQuestionAnswerEvaluation> {
    this.lastInput = input;
    return this.result;
  }
}

class FakeStudyRepository implements StudyRepository {
  public lastInput:
    | CreateStudyAnswerAttemptInput
    | null = null;

  public async createAnswerAttempt(
    input: CreateStudyAnswerAttemptInput,
  ): Promise<StudyAnswerAttemptRecord> {
    this.lastInput = input;

    return {
      id: "attempt-1",
      ...input,
      answeredAt: new Date(
        "2026-09-08T12:00:00.000Z",
      ),
    };
  }
}

describe("SubmitStudyQuestionAnswerUseCase", () => {
  it("evaluates and persists a multiple-choice attempt", async () => {
    const evaluator =
      new FakeQuestionAnswerEvaluator();
    const repository = new FakeStudyRepository();
    const useCase = new SubmitStudyQuestionAnswerUseCase(
      evaluator,
      repository,
    );

    const result = await useCase.execute({
      profileId: "  profile-1  ",
      questionId: "  question-1  ",
      answer: {
        type: "MULTIPLE_CHOICE",
        alternativeId: "  alternative-a  ",
      },
      responseTimeMs: 4500,
    });

    expect(evaluator.lastInput).toEqual({
      questionId: "question-1",
      answer: {
        type: "MULTIPLE_CHOICE",
        alternativeId: "alternative-a",
      },
    });

    expect(repository.lastInput).toEqual({
      profileId: "profile-1",
      questionId: "question-1",
      questionType: "MULTIPLE_CHOICE",
      selectedAlternativeId: "alternative-a",
      selectedTrueFalse: null,
      isCorrect: true,
      responseTimeMs: 4500,
    });

    expect(result).toMatchObject({
      attemptId: "attempt-1",
      questionId: "question-1",
      isCorrect: true,
      explanation: "A alternativa A esta correta.",
    });
  });

  it("persists a True/False attempt", async () => {
    const evaluator =
      new FakeQuestionAnswerEvaluator();
    evaluator.result = {
      questionId: "question-2",
      questionType: "TRUE_FALSE",
      isCorrect: false,
      selectedAnswer: {
        type: "TRUE_FALSE",
        value: false,
      },
      correctAnswer: {
        type: "TRUE_FALSE",
        value: true,
      },
      explanation: null,
    };

    const repository = new FakeStudyRepository();
    const useCase = new SubmitStudyQuestionAnswerUseCase(
      evaluator,
      repository,
    );

    const result = await useCase.execute({
      profileId: "profile-1",
      questionId: "question-2",
      answer: {
        type: "TRUE_FALSE",
        value: false,
      },
    });

    expect(repository.lastInput).toEqual({
      profileId: "profile-1",
      questionId: "question-2",
      questionType: "TRUE_FALSE",
      selectedAlternativeId: null,
      selectedTrueFalse: false,
      isCorrect: false,
      responseTimeMs: null,
    });

    expect(result.isCorrect).toBe(false);
    expect(result.correctAnswer).toEqual({
      type: "TRUE_FALSE",
      value: true,
    });
  });

  it("rejects invalid caller input before evaluation", async () => {
    const evaluator =
      new FakeQuestionAnswerEvaluator();
    const repository = new FakeStudyRepository();
    const useCase = new SubmitStudyQuestionAnswerUseCase(
      evaluator,
      repository,
    );

    await expect(
      useCase.execute({
        profileId: "   ",
        questionId: "question-1",
        answer: {
          type: "MULTIPLE_CHOICE",
          alternativeId: "alternative-a",
        },
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });

    await expect(
      useCase.execute({
        profileId: "profile-1",
        questionId: "question-1",
        answer: {
          type: "MULTIPLE_CHOICE",
          alternativeId: "alternative-a",
        },
        responseTimeMs: -1,
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });

    expect(evaluator.lastInput).toBeNull();
    expect(repository.lastInput).toBeNull();
  });

  it("rejects an empty multiple-choice alternative", async () => {
    const evaluator =
      new FakeQuestionAnswerEvaluator();
    const repository = new FakeStudyRepository();
    const useCase = new SubmitStudyQuestionAnswerUseCase(
      evaluator,
      repository,
    );

    await expect(
      useCase.execute({
        profileId: "profile-1",
        questionId: "question-1",
        answer: {
          type: "MULTIPLE_CHOICE",
          alternativeId: "   ",
        },
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects an inconsistent evaluator result", async () => {
    const evaluator =
      new FakeQuestionAnswerEvaluator();
    evaluator.result = {
      ...evaluator.result,
      questionId: "another-question",
    };

    const repository = new FakeStudyRepository();
    const useCase = new SubmitStudyQuestionAnswerUseCase(
      evaluator,
      repository,
    );

    await expect(
      useCase.execute({
        profileId: "profile-1",
        questionId: "question-1",
        answer: {
          type: "MULTIPLE_CHOICE",
          alternativeId: "alternative-a",
        },
      }),
    ).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });

    expect(repository.lastInput).toBeNull();
  });
});
