import type {
  PrismaClient,
} from "@/generated/prisma/client";

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
  PrismaPublicQuestionReadRepository,
} from "./prisma-public-question-read-repository";

function createPrismaMock() {
  const questionFindMany = vi.fn();
  const questionFindFirst = vi.fn();
  const questionCount = vi.fn();
  const disciplineFindMany = vi.fn();
  const boardFindMany = vi.fn();
  const examinationFindMany = vi.fn();

  const prisma = {
    question: {
      findMany: questionFindMany,
      findFirst: questionFindFirst,
      count: questionCount,
    },
    discipline: {
      findMany: disciplineFindMany,
    },
    examiningBoard: {
      findMany: boardFindMany,
    },
    examination: {
      findMany: examinationFindMany,
    },
  } as unknown as PrismaClient;

  return {
    prisma,
    questionFindMany,
    questionFindFirst,
    questionCount,
    disciplineFindMany,
    boardFindMany,
    examinationFindMany,
  };
}

const validPublicRow = {
  id: "question-1",
  type: "MULTIPLE_CHOICE",
  statement: "Qual alternativa esta correta?",
  alternatives: [
    {
      id: "alternative-a",
      label: "A",
      content: "Alternativa A",
      position: 1,
    },
    {
      id: "alternative-b",
      label: "B",
      content: "Alternativa B",
      position: 2,
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
  occurrences: [
    {
      id: "occurrence-1",
      externalQuestionNumber: "10",
      source: {
        name: "Quest API",
      },
      examination: {
        id: "exam-1",
        title: "Concurso 2026",
        year: 2026,
        board: {
          id: "board-1",
          name: "Banca Exemplo",
          acronym: "BE",
        },
        organization: {
          id: "organization-1",
          name: "Órgão Exemplo",
        },
        careerPosition: {
          id: "career-1",
          name: "Cargo Exemplo",
        },
      },
    },
  ],
} as const;

describe("PrismaPublicQuestionReadRepository", () => {
  it("lists only published questions with safe public fields", async () => {
    const {
      prisma,
      questionFindMany,
      questionCount,
    } = createPrismaMock();

    questionFindMany.mockResolvedValue([
      validPublicRow,
    ]);
    questionCount.mockResolvedValue(1);

    const repository =
      new PrismaPublicQuestionReadRepository(
        prisma,
      );

    const result = await repository.listPublished({
      filters: {
        search: "constitucional",
        disciplineId: "discipline-1",
        boardId: "board-1",
        year: 2026,
        type: QUESTION_TYPES.MULTIPLE_CHOICE,
      },
      offset: 20,
      limit: 10,
    });

    const expectedWhere = {
      status: "PUBLISHED",
      statement: {
        contains: "constitucional",
        mode: "insensitive",
      },
      disciplineId: "discipline-1",
      type: "MULTIPLE_CHOICE",
      OR: [
        {
          examination: {
            is: {
              boardId: "board-1",
              year: 2026,
            },
          },
        },
        {
          occurrences: {
            some: {
              examination: {
                is: {
                  boardId: "board-1",
                  year: 2026,
                },
              },
            },
          },
        },
      ],
    };

    expect(questionFindMany).toHaveBeenCalledWith(
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

    expect(questionCount).toHaveBeenCalledWith({
      where: expectedWhere,
    });

    const call =
      questionFindMany.mock.calls[0]?.[0];

    expect(call?.select).not.toHaveProperty(
      "answerKeyStatus",
    );
    expect(call?.select).not.toHaveProperty(
      "correctTrueFalse",
    );
    expect(call?.select).not.toHaveProperty(
      "explanation",
    );
    expect(
      call?.select.alternatives.select,
    ).not.toHaveProperty("isCorrect");
    expect(
      call?.select.occurrences.select,
    ).toEqual(
      expect.objectContaining({
        id: true,
        externalQuestionNumber: true,
        source: {
          select: {
            name: true,
          },
        },
      }),
    );

    expect(result).toEqual({
      items: [validPublicRow],
      total: 1,
    });
  });

  it("restricts public lookup by id to published questions", async () => {
    const {
      prisma,
      questionFindFirst,
    } = createPrismaMock();

    questionFindFirst.mockResolvedValue(
      validPublicRow,
    );

    const repository =
      new PrismaPublicQuestionReadRepository(
        prisma,
      );

    const result =
      await repository.findPublishedById(
        "question-1",
      );

    expect(questionFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "question-1",
          status: "PUBLISHED",
        },
      }),
    );

    const call =
      questionFindFirst.mock.calls[0]?.[0];

    expect(call?.select).not.toHaveProperty(
      "answerKeyStatus",
    );
    expect(
      call?.select.alternatives.select,
    ).not.toHaveProperty("isCorrect");

    expect(result?.id).toBe("question-1");
  });

  it("returns explorer facets backed by published questions", async () => {
    const {
      prisma,
      questionFindMany,
      disciplineFindMany,
      boardFindMany,
      examinationFindMany,
    } = createPrismaMock();

    disciplineFindMany.mockResolvedValue([
      {
        id: "discipline-1",
        name: "Direito Constitucional",
      },
    ]);
    boardFindMany.mockResolvedValue([
      {
        id: "board-1",
        name: "Instituto AOCP",
        acronym: "AOCP",
      },
    ]);
    examinationFindMany.mockResolvedValue([
      { year: 2026 },
      { year: 2025 },
    ]);
    questionFindMany.mockResolvedValue([
      { type: "MULTIPLE_CHOICE" },
      { type: "TRUE_FALSE" },
    ]);

    const repository =
      new PrismaPublicQuestionReadRepository(
        prisma,
      );

    const result =
      await repository.listExplorerFacets();

    expect(
      disciplineFindMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          questions: {
            some: {
              status: "PUBLISHED",
            },
          },
        },
      }),
    );

    expect(result).toEqual({
      disciplines: [
        {
          id: "discipline-1",
          name: "Direito Constitucional",
        },
      ],
      boards: [
        {
          id: "board-1",
          name: "Instituto AOCP",
          acronym: "AOCP",
        },
      ],
      years: [2026, 2025],
      types: [
        "MULTIPLE_CHOICE",
        "TRUE_FALSE",
      ],
    });
  });

  it("rejects public rows without mandatory taxonomy", async () => {
    const {
      prisma,
      questionFindFirst,
    } = createPrismaMock();

    questionFindFirst.mockResolvedValue({
      ...validPublicRow,
      topic: null,
    });

    const repository =
      new PrismaPublicQuestionReadRepository(
        prisma,
      );

    await expect(
      repository.findPublishedById(
        "question-1",
      ),
    ).rejects.toThrow(
      "Published question question-1 is missing required taxonomy.",
    );
  });
});
