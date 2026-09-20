import {
  createHash,
} from "node:crypto";

import type {
  PrismaClient,
} from "@/generated/prisma/client";
import {
  getPrismaClient,
} from "@/shared/infrastructure/database/prisma";

import type {
  QuestionReviewRepository,
  ReviewPublicationCandidate,
  ReviewQuestionListItem,
  ReviewTaxonomyReference,
} from "../../application/ports/question-review-repository";

function slugify(
  value: string,
): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);

  if (normalized) {
    return normalized;
  }

  return createHash("sha256")
    .update(value, "utf8")
    .digest("hex")
    .slice(0, 24);
}

export class PrismaQuestionReviewRepository
  implements QuestionReviewRepository
{
  public constructor(
    private readonly prisma: PrismaClient =
      getPrismaClient(),
  ) {}

  public async listInReview(): Promise<
    readonly ReviewQuestionListItem[]
  > {
    const rows =
      await this.prisma.question.findMany({
        where: {
          status: "IN_REVIEW",
        },
        orderBy: [
          {
            updatedAt: "desc",
          },
          {
            id: "asc",
          },
        ],
        take: 100,
        select: {
          id: true,
          type: true,
          statement: true,
          answerKeyStatus: true,
          updatedAt: true,
          discipline: {
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
          occurrences: {
            orderBy: {
              capturedAt: "asc",
            },
            select: {
              id: true,
              externalQuestionNumber: true,
              source: {
                select: {
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
                      name: true,
                    },
                  },
                  organization: {
                    select: {
                      name: true,
                    },
                  },
                  careerPosition: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      statement: row.statement,
      answerKeyStatus:
        row.answerKeyStatus,
      discipline: row.discipline,
      topic: row.topic,
      occurrences:
        row.occurrences.map(
          (occurrence) => ({
            id: occurrence.id,
            sourceName:
              occurrence.source.name,
            externalQuestionNumber:
              occurrence.externalQuestionNumber,
            examination:
              occurrence.examination
                ? {
                    id:
                      occurrence.examination.id,
                    title:
                      occurrence.examination.title,
                    year:
                      occurrence.examination.year,
                    board:
                      occurrence.examination.board
                        ?.name ?? null,
                    organization:
                      occurrence.examination
                        .organization?.name ??
                      null,
                    careerPosition:
                      occurrence.examination
                        .careerPosition?.name ??
                      null,
                  }
                : null,
          }),
        ),
      updatedAt: row.updatedAt,
    }));
  }

  public async assignTopic(
    input: Readonly<{
      questionId: string;
      topicName: string;
    }>,
  ): Promise<ReviewTaxonomyReference | null> {
    return this.prisma.$transaction(
      async (transaction) => {
        const question =
          await transaction.question.findFirst({
            where: {
              id: input.questionId,
              status: "IN_REVIEW",
            },
            select: {
              disciplineId: true,
            },
          });

        if (!question?.disciplineId) {
          return null;
        }

        const topic =
          await transaction.topic.upsert({
            where: {
              disciplineId_slug: {
                disciplineId:
                  question.disciplineId,
                slug: slugify(
                  input.topicName,
                ),
              },
            },
            update: {
              name: input.topicName,
              isActive: true,
            },
            create: {
              disciplineId:
                question.disciplineId,
              name: input.topicName,
              slug: slugify(
                input.topicName,
              ),
            },
            select: {
              id: true,
              name: true,
            },
          });

        await transaction.question.update({
          where: {
            id: input.questionId,
          },
          data: {
            topicId: topic.id,
          },
        });

        return topic;
      },
    );
  }

  public async findPublicationCandidate(
    questionId: string,
  ): Promise<ReviewPublicationCandidate | null> {
    const question =
      await this.prisma.question.findFirst({
        where: {
          id: questionId,
          status: "IN_REVIEW",
        },
        select: {
          id: true,
          type: true,
          statement: true,
          sourceId: true,
          disciplineId: true,
          topicId: true,
          correctTrueFalse: true,
          alternatives: {
            orderBy: {
              position: "asc",
            },
            select: {
              content: true,
              isCorrect: true,
            },
          },
        },
      });

    return question;
  }

  public async publishQuestion(
    questionId: string,
  ): Promise<boolean> {
    const result =
      await this.prisma.question.updateMany({
        where: {
          id: questionId,
          status: "IN_REVIEW",
        },
        data: {
          status: "PUBLISHED",
          answerKeyStatus: "VERIFIED",
          publishedAt: new Date(),
        },
      });

    return result.count === 1;
  }
}
