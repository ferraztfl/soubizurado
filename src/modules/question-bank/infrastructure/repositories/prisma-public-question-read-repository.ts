import { toTaxonomySlug } from "@/modules/taxonomy/domain/taxonomy-term";
import type {
  Prisma,
  PrismaClient,
} from "@/generated/prisma/client";
import { parseQuestionCode, parseQuestionReference } from "@/modules/question-bank/domain/question-code";

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
  publicNumber: true,
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
  mediaLinks: {
    orderBy: {
      position: "asc",
    },
    select: {
      role: true,
      position: true,
      mediaAsset: {
        select: {
          id: true,
          mimeType: true,
          width: true,
          height: true,
          altText: true,
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
      mediaLinks: {
        orderBy: {
          position: "asc",
        },
        select: {
          position: true,
          mediaAsset: {
            select: {
              id: true,
              mimeType: true,
              width: true,
              height: true,
              altText: true,
            },
          },
        },
      },
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
  source: { select: { sourceType: true } },
  // Where each image inside the texts was stored (source URL → asset).
  mediaTasks: {
    where: { mediaAssetId: { not: null } },
    select: { sourceUrl: true, mediaAssetId: true },
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
    ...(filters.organizationId ? { organizationId: filters.organizationId } : {}),
    ...(filters.careerPositionId ? { careerPositionId: filters.careerPositionId } : {}),
  };

  const hasExaminationFilters = Object.keys(examinationFilters).length > 0;

  const answered = filters.answered;
  const answeredFilter: Prisma.QuestionWhereInput = !answered
    ? {}
    : answered.status === "unanswered"
      ? { studyAnswerAttempts: { none: { profileId: answered.profileId } } }
      : {
          studyAnswerAttempts: {
            some: { profileId: answered.profileId, isCorrect: answered.status === "correct" },
          },
        };

  return {
    status: "PUBLISHED",
    ...answeredFilter,
    ...(filters.favoriteOfProfileId
      ? { studyFavorites: { some: { profileId: filters.favoriteOfProfileId } } }
      : {}),
    ...(filters.ids ? { id: { in: [...filters.ids] } } : {}),
    // A search for a question code ("Q100001") finds that question.
    ...(filters.search
      ? parseQuestionCode(filters.search) !== null
        ? { publicNumber: parseQuestionCode(filters.search)! }
        : {
            // The text or the classification (Tópico, Subtópico, Detalhe) by name.
            OR: [
              { statement: { contains: filters.search, mode: "insensitive" as const } },
              // Slugs carry no accents, so "codigo disciplinar" finds "Código Disciplinar".
              ...(toTaxonomySlug(filters.search)
                ? [
                    { area: { slug: { contains: toTaxonomySlug(filters.search) } } },
                    { topic: { slug: { contains: toTaxonomySlug(filters.search) } } },
                    { subtopic: { slug: { contains: toTaxonomySlug(filters.search) } } },
                  ]
                : []),
            ],
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

  const supportContents = (
    question.supportLinks ?? []
  ).map((link) => ({
    id: link.supportContent.id,
    content: link.supportContent.content,
    position: link.position,
  }));

  const media = (
    question.mediaLinks ?? []
  )
    .filter(
      (link) =>
        link.role ===
        "QUESTION_ATTACHMENT",
    )
    .map((link) => ({
      id: link.mediaAsset.id,
      mimeType:
        link.mediaAsset.mimeType,
      width:
        link.mediaAsset.width,
      height:
        link.mediaAsset.height,
      altText:
        link.mediaAsset.altText,
      position:
        link.position,
    }));

  const alternatives =
    question.alternatives.map(
      (alternative) => {
        const alternativeMedia =
          (
            alternative.mediaLinks ??
            []
          ).map((link) => ({
            id:
              link.mediaAsset.id,
            mimeType:
              link.mediaAsset
                .mimeType,
            width:
              link.mediaAsset.width,
            height:
              link.mediaAsset.height,
            altText:
              link.mediaAsset.altText,
            position:
              link.position,
          }));

        return {
          id:
            alternative.id,
          label:
            alternative.label,
          content:
            alternative.content,
          position:
            alternative.position,
          ...(alternativeMedia.length >
          0
            ? {
                media:
                  alternativeMedia,
              }
            : {}),
        };
      },
    );

  return {
    id: question.id,
    publicNumber: question.publicNumber,
    type: question.type,
    statement: question.statement,
    ...(supportContents.length > 0
      ? { supportContents }
      : {}),
    ...(media.length > 0
      ? { media }
      : {}),
    alternatives,
    discipline: question.discipline,
    area: question.area,
    topic: question.topic,
    subtopic: question.subtopic,
    examination: question.examination,
    isOriginal: question.source?.sourceType === "ORIGINAL",
    textImageAssets: Object.fromEntries(
      (question.mediaTasks ?? []).flatMap((task) =>
        task.mediaAssetId ? [[task.sourceUrl, task.mediaAssetId]] : [],
      ),
    ),
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
        orderBy:
          input.sort === "oldest"
            ? [{ publicNumber: "asc" }]
            : input.sort === "year"
              ? [{ examination: { year: "desc" } }, { publicNumber: "desc" }]
              : [{ publishedAt: "desc" }, { publicNumber: "desc" }],
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

  public async listPublishedIds(filters: PublicQuestionReadFilters): Promise<readonly string[]> {
    const rows = await this.prisma.question.findMany({
      where: buildPublicQuestionWhere(filters),
      select: { id: true },
    });

    return rows.map((row) => row.id);
  }

  /**
   * Up to `count` random published ids matching the filters, without
   * loading every match (millions of questions): a random window of the
   * ordered matches is fetched and shuffled.
   */
  public async drawPublishedIds(
    filters: PublicQuestionReadFilters,
    count: number,
    random: () => number = Math.random,
  ): Promise<string[]> {
    const where = buildPublicQuestionWhere(filters);
    const total = await this.prisma.question.count({ where });

    if (total === 0 || count <= 0) {
      return [];
    }

    const window = Math.min(total, Math.max(count * 5, 50), 1_000);
    const skip = Math.floor(random() * (total - window + 1));
    const rows = await this.prisma.question.findMany({
      where,
      orderBy: { publicNumber: "asc" },
      skip,
      take: window,
      select: { id: true },
    });
    const pool = rows.map((row) => row.id);

    for (let index = pool.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [pool[index], pool[swap]] = [pool[swap]!, pool[index]!];
    }

    return pool.slice(0, count);
  }

  /** Accepts the public code (Q100001) or the internal UUID. */
  public async findPublishedById(
    questionId: string,
  ): Promise<PublicQuestionReadRecord | null> {
    const reference = parseQuestionReference(questionId);

    if (reference.kind === "invalid") {
      return null;
    }

    const question =
      await this.prisma.question.findFirst({
        where: {
          ...(reference.kind === "code"
            ? { publicNumber: reference.publicNumber }
            : { id: reference.id }),
          status: "PUBLISHED",
        },
        select: publicQuestionSelect,
      });

    return question
      ? toPublicQuestionReadRecord(question)
      : null;
  }

  public async listExplorerFacets(): Promise<QuestionExplorerFacets> {
    const withPublishedQuestions = { some: { status: "PUBLISHED" as const } };
    const examinationsWithPublishedQuestions = { some: { questions: withPublishedQuestions } };

    const [
      disciplines,
      boards,
      yearRows,
      typeRows,
      areas,
      topicRows,
      organizations,
      careerPositions,
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
      this.prisma.area.findMany({
        where: { isActive: true, questions: withPublishedQuestions },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, disciplineId: true },
      }),
      this.prisma.topic.findMany({
        where: { isActive: true, areaId: { not: null }, questions: withPublishedQuestions },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, areaId: true },
      }),
      this.prisma.publicOrganization.findMany({
        where: { isActive: true, examinations: examinationsWithPublishedQuestions },
        orderBy: { name: "asc" },
        select: { id: true, name: true, acronym: true },
      }),
      this.prisma.careerPosition.findMany({
        where: { isActive: true, examinations: examinationsWithPublishedQuestions },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

    return {
      disciplines,
      areas,
      topics: topicRows.flatMap((topic) =>
        topic.areaId === null ? [] : [{ id: topic.id, name: topic.name, areaId: topic.areaId }],
      ),
      organizations,
      careerPositions,
      boards,
      years: yearRows.flatMap((row) =>
        row.year === null ? [] : [row.year],
      ),
      types: typeRows.map((row) => row.type),
    };
  }
}
