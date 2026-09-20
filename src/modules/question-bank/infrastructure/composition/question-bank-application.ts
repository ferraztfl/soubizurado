import {
  AssignQuestionTopicUseCase,
} from "../../application/use-cases/assign-question-topic";
import {
  GetPublishedQuestionByIdUseCase,
} from "../../application/use-cases/get-published-question-by-id";
import {
  ListPublishedQuestionsUseCase,
} from "../../application/use-cases/list-published-questions";
import {
  ListQuestionsForReviewUseCase,
} from "../../application/use-cases/list-questions-for-review";
import {
  ListQuestionExplorerFacetsUseCase,
} from "../../application/use-cases/list-question-explorer-facets";
import {
  PublishReviewedQuestionUseCase,
} from "../../application/use-cases/publish-reviewed-question";
import {
  SubmitPublishedQuestionAnswerUseCase,
} from "../../application/use-cases/submit-published-question-answer";
import {
  PrismaPublicQuestionReadRepository,
} from "../repositories/prisma-public-question-read-repository";
import {
  PrismaQuestionReviewRepository,
} from "../repositories/prisma-question-review-repository";
import {
  PrismaQuestionRepository,
} from "../repositories/prisma-question-repository";

export function createListPublishedQuestionsUseCase(): ListPublishedQuestionsUseCase {
  return new ListPublishedQuestionsUseCase(
    new PrismaPublicQuestionReadRepository(),
  );
}

export function createGetPublishedQuestionByIdUseCase(): GetPublishedQuestionByIdUseCase {
  return new GetPublishedQuestionByIdUseCase(
    new PrismaPublicQuestionReadRepository(),
  );
}

export function createListQuestionExplorerFacetsUseCase(): ListQuestionExplorerFacetsUseCase {
  return new ListQuestionExplorerFacetsUseCase(
    new PrismaPublicQuestionReadRepository(),
  );
}

export function createSubmitPublishedQuestionAnswerUseCase(): SubmitPublishedQuestionAnswerUseCase {
  return new SubmitPublishedQuestionAnswerUseCase(
    new PrismaQuestionRepository(),
  );
}


export function createListQuestionsForReviewUseCase(): ListQuestionsForReviewUseCase {
  return new ListQuestionsForReviewUseCase(
    new PrismaQuestionReviewRepository(),
  );
}

export function createAssignQuestionTopicUseCase(): AssignQuestionTopicUseCase {
  return new AssignQuestionTopicUseCase(
    new PrismaQuestionReviewRepository(),
  );
}

export function createPublishReviewedQuestionUseCase(): PublishReviewedQuestionUseCase {
  return new PublishReviewedQuestionUseCase(
    new PrismaQuestionReviewRepository(),
  );
}
