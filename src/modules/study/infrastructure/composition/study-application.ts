import {
  createSubmitPublishedQuestionAnswerUseCase,
} from "../../../question-bank/infrastructure/composition/question-bank-application";

import {
  ListStudyAnswerHistoryUseCase,
} from "../../application/use-cases/list-study-answer-history";
import {
  ListStudyFavoritesUseCase,
} from "../../application/use-cases/list-study-favorites";
import {
  ListStudyIncorrectQuestionsUseCase,
} from "../../application/use-cases/list-study-incorrect-questions";
import {
  SetStudyQuestionFavoriteUseCase,
} from "../../application/use-cases/set-study-question-favorite";
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

export function createListStudyAnswerHistoryUseCase(): ListStudyAnswerHistoryUseCase {
  return new ListStudyAnswerHistoryUseCase(
    new PrismaStudyRepository(),
  );
}

export function createSetStudyQuestionFavoriteUseCase(): SetStudyQuestionFavoriteUseCase {
  return new SetStudyQuestionFavoriteUseCase(
    new PrismaStudyRepository(),
  );
}

export function createListStudyFavoritesUseCase(): ListStudyFavoritesUseCase {
  return new ListStudyFavoritesUseCase(
    new PrismaStudyRepository(),
  );
}

export function createListStudyIncorrectQuestionsUseCase(): ListStudyIncorrectQuestionsUseCase {
  return new ListStudyIncorrectQuestionsUseCase(
    new PrismaStudyRepository(),
  );
}
