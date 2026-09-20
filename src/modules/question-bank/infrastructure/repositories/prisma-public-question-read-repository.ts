import type {
  Prisma,
  PrismaClient,
} from "@/generated/prisma/client";

import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import type {
  ListPublicQuestionsRepositoryInput,
  ListPublicQuestionsRepositoryResult,
  PublicQuestionReadFilters,
  PublicQuestionReadRecord,
  PublicQuestionReadRepository,
  QuestionExplorerFacets,
} from "../../application/ports/public-question-read-repository";

const publicQuestionSelect = {
  id: true,
  type: true,
  statement: true,
  supportLinks: {
    orderBy: {
      position: "asc",
    },
    select: {
      position: true,
      supportContent: {
        select: {
          id: true,
          content: true,
        },
      },
    },
  },
  alternatives: {
    orderBy: {
      position: "asc",
    },
    select: {
      id: true,
      label: true,
      content: true,
      position: true,
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

type PublicQuestionRow = Prisma.QuestionGetPayload<{
  select: typeof publicQuestionSelect;
}>;

function buildPublicQuestionWhere(
  filters: PublicQuestionReadFilters,
): Prisma.QuestionWhereInput {
  const examinationFilters: Prisma.ExaminationWhereInput = {
    ...(filters.boardId
      ? { boardId: filters.boardId }
      : {}),
    ...(filters.year !== undefined
      ? { year: filters.year }
      : {}),
  };

  const hasExaminationFilters =
    filters.boardId !== undefined ||
    filters.year !== undefined;

  return {
    status: "PUBLISHED",
    ...(filters.search
      ? {
          statement: {
            contains: filters.search,
            mode: "insensitive",
          },
        }
      : {}),
    ...(filters.disciplineId
      ? { disciplineId: filters.disciplineId }
      : {}),
    ...(filters.areaId
      ? { areaId: filters.areaId }
      : {}),
    ...(filters.topicId
      ? { topicId: filters.topicId }
      : {}),
    ...(filters.subtopicId
      ? { subtopicId: filters.subtopicId }
      : {}),
    ...(filters.examinationId
      ? { examinationId: filters.examinationId }
      : {}),
    ...(filters.type
      ? { type: filters.type }
      : {}),
    ...(hasExaminationFilters
      ? {
          examination: {
            is: examinationFilters,
          },
        }
      : {}),
  };
}

function toPublicQuestionReadRecord(
  question: PublicQuestionRow,
): PublicQuestionReadRecord {
  if (!question.discipline || !question.topic) {
    throw new Error(
      `Published question ${question.id} is missing required taxonomy.`,
    );
  }

  return {
    id: question.id,
    type: question.type,
    statement: question.statement,
    supportContents:
      question.supportLinks.map(
        (link) => ({
          id: link.supportContent.id,
          content:
            link.supportContent.content,
          position: link.position,
        }),
      ),
    alternatives: question.alternatives,
    discipline: question.discipline,
    area: question.area,
    topic: question.topic,
    subtopic: question.subtopic,
    examination: question.examination,
  };
}

export class PrismaPublicQuestionReadRepository
  implements PublicQuestionReadRepository
{
  public constructor(
    private readonly prisma: PrismaClient = getPrismaClient(),
  ) {}

  public async listPublished(
    input: ListPublicQuestionsRepositoryInput,
  ): Promise<ListPublicQuestionsRepositoryResult> {
    const where = buildPublicQuestionWhere(
      input.filters,
    );

    const [items, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        skip: input.offset,
        take: input.limit,
        orderBy: [
          { publishedAt: "desc" },
          { id: "asc" },
        ],
        select: publicQuestionSelect,
      }),
      this.prisma.question.count({
        where,
      }),
    ]);

    return {
      items: items.map(
        toPublicQuestionReadRecord,
      ),
      total,
    };
  }

  public async findPublishedById(
    questionId: string,
  ): Promise<PublicQuestionReadRecord | null> {
    const question =
      await this.prisma.question.findFirst({
        where: {
          id: questionId,
          status: "PUBLISHED",
        },
        select: publicQuestionSelect,
      });

    return question
      ? toPublicQuestionReadRecord(question)
      : null;
  }

  public async listExplorerFacets(): Promise<QuestionExplorerFacets> {
    const [
      disciplines,
      boards,
      yearRows,
      typeRows,
    ] = await Promise.all([
      this.prisma.discipline.findMany({
        where: {
          isActive: true,
          questions: {
            some: {
              status: "PUBLISHED",
            },
          },
        },
        orderBy: [
          { sortOrder: "asc" },
          { name: "asc" },
        ],
        select: {
          id: true,
          name: true,
        },
      }),
      this.prisma.examiningBoard.findMany({
        where: {
          isActive: true,
          examinations: {
            some: {
              questions: {
                some: {
                  status: "PUBLISHED",
                },
              },
            },
          },
        },
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
          acronym: true,
        },
      }),
      this.prisma.examination.findMany({
        where: {
          year: {
            not: null,
          },
          questions: {
            some: {
              status: "PUBLISHED",
            },
          },
        },
        distinct: ["year"],
        orderBy: {
          year: "desc",
        },
        select: {
          year: true,
        },
      }),
      this.prisma.question.findMany({
        where: {
          status: "PUBLISHED",
        },
        distinct: ["type"],
        orderBy: {
          type: "asc",
        },
        select: {
          type: true,
        },
      }),
    ]);

    return {
      disciplines,
      boards,
      years: yearRows.flatMap((row) =>
        row.year === null ? [] : [row.year],
      ),
      types: typeRows.map((row) => row.type),
    };
  }
}
