import type { PrismaClient } from "@/generated/prisma/client";

import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  QUESTION_TYPES,
} from "../../domain/question-type";

import {
  PrismaQuestionRepository,
} from "./prisma-question-repository";

function createPrismaMock(
  rows: readonly Record<string, unknown>[],
  total: number,
  found: Record<string, unknown> | null =
    rows.at(0) ?? null,
): {
  prisma: PrismaClient;
  findMany: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
} {
  const findMany = vi.fn().mockResolvedValue(rows);
  const findFirst = vi.fn().mockResolvedValue(found);
  const count = vi.fn().mockResolvedValue(total);

  const prisma = {
    question: {
      findMany,
      findFirst,
      count,
    },
  } as unknown as PrismaClient;

  return {
    prisma,
    findMany,
    findFirst,
    count,
  };
}

const validPublishedRow = {
  id: "question-1",
  type: "MULTIPLE_CHOICE",
  statement: "Qual alternativa esta correta?",
  answerKeyStatus: "VERIFIED",
  correctTrueFalse: null,
  alternatives: [
    {
      id: "alternative-a",
      label: "A",
      content: "Alternativa A",
      position: 1,
      isCorrect: true,
    },
    {
      id: "alternative-b",
      label: "B",
      content: "Alternativa B",
      position: 2,
      isCorrect: false,
    },
  ],
  explanation: {
    content: "A alternativa A esta correta.",
  },
  discipline: {
    id: "discipline-1",
    name: "Direito Constitucional",
  },
  area: null,
  topic: {
    id: "topic-1",
    name: "Direitos Fundamentais",
  },
  subtopic: null,
  examination: {
    id: "exam-1",
    title: "Concurso 2026",
    year: 2026,
    board: {
      id: "board-1",
      name: "Banca Exemplo",
      acronym: "BE",
    },
  },
} as const;

describe("PrismaQuestionRepository", () => {
  it("always restricts listing to published questions and applies filters", async () => {
    const {
      prisma,
      findMany,
      count,
    } = createPrismaMock(
      [validPublishedRow],
      1,
    );

    const repository =
      new PrismaQuestionRepository(prisma);

    await repository.listPublished({
      filters: {
        disciplineId: "discipline-1",
        areaId: "area-1",
        topicId: "topic-1",
        subtopicId: "subtopic-1",
        boardId: "board-1",
        examinationId: "exam-1",
        year: 2026,
        type: QUESTION_TYPES.MULTIPLE_CHOICE,
      },
      offset: 20,
      limit: 10,
    });

    const expectedWhere = {
      status: "PUBLISHED",
      disciplineId: "discipline-1",
      areaId: "area-1",
      topicId: "topic-1",
      subtopicId: "subtopic-1",
      examinationId: "exam-1",
      type: "MULTIPLE_CHOICE",
      examination: {
        is: {
          boardId: "board-1",
          year: 2026,
        },
      },
    };

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expectedWhere,
        skip: 20,
        take: 10,
        orderBy: [
          { publishedAt: "desc" },
          { id: "asc" },
        ],
      }),
    );

    expect(count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });

  it("maps Prisma data to the application repository contract", async () => {
    const { prisma } = createPrismaMock(
      [validPublishedRow],
      1,
    );

    const repository =
      new PrismaQuestionRepository(prisma);

    const result = await repository.listPublished({
      filters: {},
      offset: 0,
      limit: 20,
    });

    expect(result.total).toBe(1);
    expect(result.items).toEqual([
      {
        id: "question-1",
        type: "MULTIPLE_CHOICE",
        statement: "Qual alternativa esta correta?",
        answerKeyStatus: "VERIFIED",
        correctTrueFalse: null,
        explanation: "A alternativa A esta correta.",
        alternatives: [
          {
            id: "alternative-a",
            label: "A",
            content: "Alternativa A",
            position: 1,
            isCorrect: true,
          },
          {
            id: "alternative-b",
            label: "B",
            content: "Alternativa B",
            position: 2,
            isCorrect: false,
          },
        ],
        discipline: {
          id: "discipline-1",
          name: "Direito Constitucional",
        },
        area: null,
        topic: {
          id: "topic-1",
          name: "Direitos Fundamentais",
        },
        subtopic: null,
        examination: {
          id: "exam-1",
          title: "Concurso 2026",
          year: 2026,
          board: {
            id: "board-1",
            name: "Banca Exemplo",
            acronym: "BE",
          },
        },
      },
    ]);
  });

  it("rejects an invalid published row without mandatory taxonomy", async () => {
    const invalidRow = {
      ...validPublishedRow,
      discipline: null,
    };

    const { prisma } = createPrismaMock(
      [invalidRow],
      1,
    );

    const repository =
      new PrismaQuestionRepository(prisma);

    await expect(
      repository.listPublished({
        filters: {},
        offset: 0,
        limit: 20,
      }),
    ).rejects.toThrow(
      "Published question question-1 is missing required taxonomy.",
    );
  });

  it("restricts lookup by id to published questions", async () => {
    const {
      prisma,
      findFirst,
    } = createPrismaMock(
      [validPublishedRow],
      1,
    );

    const repository =
      new PrismaQuestionRepository(prisma);

    const result =
      await repository.findPublishedById(
        "question-1",
      );

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "question-1",
          status: "PUBLISHED",
        },
      }),
    );

    expect(result?.id).toBe("question-1");
  });

  it("returns null when no published question matches the id", async () => {
    const {
      prisma,
    } = createPrismaMock([], 0, null);

    const repository =
      new PrismaQuestionRepository(prisma);

    await expect(
      repository.findPublishedById(
        "missing-question",
      ),
    ).resolves.toBeNull();
  });
});
