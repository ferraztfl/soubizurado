import { ListPublishedQuestionsUseCase } from "../../application/use-cases/list-published-questions";
import { PrismaQuestionRepository } from "../repositories/prisma-question-repository";

export function createListPublishedQuestionsUseCase(): ListPublishedQuestionsUseCase {
  return new ListPublishedQuestionsUseCase(
    new PrismaQuestionRepository(),
  );
}
