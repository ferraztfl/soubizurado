import {
  createSubmitPublishedQuestionAnswerUseCase,
} from "../../../question-bank/infrastructure/composition/question-bank-application";

import {
  SubmitStudyQuestionAnswerUseCase,
} from "../../application/use-cases/submit-study-question-answer";

import {
  QuestionBankAnswerEvaluator,
} from "../adapters/question-bank-answer-evaluator";
import {
  PrismaStudyRepository,
} from "../repositories/prisma-study-repository";

export function createSubmitStudyQuestionAnswerUseCase(): SubmitStudyQuestionAnswerUseCase {
  return new SubmitStudyQuestionAnswerUseCase(
    new QuestionBankAnswerEvaluator(
      createSubmitPublishedQuestionAnswerUseCase(),
    ),
    new PrismaStudyRepository(),
  );
}
