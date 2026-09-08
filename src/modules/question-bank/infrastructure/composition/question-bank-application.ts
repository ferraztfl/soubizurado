import { GetPublishedQuestionByIdUseCase } from "../../application/use-cases/get-published-question-by-id";
import { ListPublishedQuestionsUseCase } from "../../application/use-cases/list-published-questions";
import { SubmitPublishedQuestionAnswerUseCase } from "../../application/use-cases/submit-published-question-answer";
import { PrismaQuestionRepository } from "../repositories/prisma-question-repository";

export function createListPublishedQuestionsUseCase(): ListPublishedQuestionsUseCase {
  return new ListPublishedQuestionsUseCase(
    new PrismaQuestionRepository(),
  );
}

export function createGetPublishedQuestionByIdUseCase(): GetPublishedQuestionByIdUseCase {
  return new GetPublishedQuestionByIdUseCase(
    new PrismaQuestionRepository(),
  );
}

export function createSubmitPublishedQuestionAnswerUseCase(): SubmitPublishedQuestionAnswerUseCase {
  return new SubmitPublishedQuestionAnswerUseCase(
    new PrismaQuestionRepository(),
  );
}
