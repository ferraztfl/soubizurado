import type {
  Prisma,
  PrismaClient,
} from "@/generated/prisma/client";

import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import type {
  PublishedQuestionRecord,
  QuestionRepository,
} from "../../application/ports/question-repository";

const publishedQuestionSelect = {
  id: true,
  type: true,
  statement: true,
  answerKeyStatus: true,
  correctTrueFalse: true,
  alternatives: {
    orderBy: {
      position: "asc",
    },
    select: {
      id: true,
      label: true,
      content: true,
      position: true,
      isCorrect: true,
    },
  },
  explanation: {
    select: {
      content: true,
    },
  },
  discipline: {
    select: {
      id: true,
      name: true,
    },
  },
  area: {
    select: {
      id: true,
      name: true,
    },
  },
  topic: {
    select: {
      id: true,
      name: true,
    },
  },
  subtopic: {
    select: {
      id: true,
      name: true,
    },
  },
  examination: {
    select: {
      id: true,
      title: true,
      year: true,
      board: {
        select: {
          id: true,
          name: true,
          acronym: true,
        },
      },
    },
  },
} satisfies Prisma.QuestionSelect;

type PublishedQuestionRow = Prisma.QuestionGetPayload<{
  select: typeof publishedQuestionSelect;
}>;

function toPublishedQuestionRecord(
  question: PublishedQuestionRow,
): PublishedQuestionRecord {
  if (!question.discipline || !question.topic) {
    throw new Error(
      `Published question ${question.id} is missing required taxonomy.`,
    );
  }

  return {
    id: question.id,
    type: question.type,
    statement: question.statement,
    answerKeyStatus: question.answerKeyStatus,
    correctTrueFalse: question.correctTrueFalse,
    explanation:
      question.explanation?.content ?? null,
    alternatives: question.alternatives.map(
      (alternative) => ({
        id: alternative.id,
        label: alternative.label,
        content: alternative.content,
        position: alternative.position,
        isCorrect: alternative.isCorrect,
      }),
    ),
    discipline: question.discipline,
    area: question.area,
    topic: question.topic,
    subtopic: question.subtopic,
    examination: question.examination,
  };
}

export class PrismaQuestionRepository
  implements QuestionRepository
{
  public constructor(
    private readonly prisma: PrismaClient = getPrismaClient(),
  ) {}

  public async findPublishedById(
    questionId: string,
  ): Promise<PublishedQuestionRecord | null> {
    const question =
      await this.prisma.question.findFirst({
        where: {
          id: questionId,
          status: "PUBLISHED",
        },
        select: publishedQuestionSelect,
      });

    return question
      ? toPublishedQuestionRecord(question)
      : null;
  }
}
