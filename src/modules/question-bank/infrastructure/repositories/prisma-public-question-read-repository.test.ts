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
  const areaFindMany = vi.fn().mockResolvedValue([
    { id: "area-1", name: "Direitos Fundamentais", disciplineId: "discipline-1" },
  ]);
  const topicFindMany = vi.fn().mockResolvedValue([
    { id: "topic-1", name: "Direitos Individuais", areaId: "area-1" },
    { id: "topic-legacy", name: "Sem tópico", areaId: null },
  ]);
  const organizationFindMany = vi.fn().mockResolvedValue([
    { id: "org-1", name: "Polícia Militar de Pernambuco", acronym: "PMPE" },
  ]);
  const careerPositionFindMany = vi.fn().mockResolvedValue([{ id: "career-1", name: "Soldado" }]);

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
    area: {
      findMany: areaFindMany,
    },
    topic: {
      findMany: topicFindMany,
    },
    publicOrganization: {
      findMany: organizationFindMany,
    },
    careerPosition: {
      findMany: careerPositionFindMany,
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
  publicNumber: 100001,
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
} as const;

describe("PrismaPublicQuestionReadRepository", () => {
  it("filters by exam organization, career and the student's answers", async () => {
    const { prisma, questionFindMany, questionCount } = createPrismaMock();
    questionFindMany.mockResolvedValue([]);
    questionCount.mockResolvedValue(0);
    const repository = new PrismaPublicQuestionReadRepository(prisma);

    await repository.listPublished({
      filters: {
        areaId: "area-1",
        organizationId: "org-1",
        careerPositionId: "career-1",
        answered: { profileId: "profile-1", status: "unanswered" },
      },
      offset: 0,
      limit: 20,
    });

    expect(questionCount).toHaveBeenLastCalledWith({
      where: {
        status: "PUBLISHED",
        studyAnswerAttempts: { none: { profileId: "profile-1" } },
        areaId: "area-1",
        examination: { is: { organizationId: "org-1", careerPositionId: "career-1" } },
      },
    });

    await repository.listPublished({
      filters: { answered: { profileId: "profile-1", status: "wrong" } },
      offset: 0,
      limit: 20,
    });

    expect(questionCount).toHaveBeenLastCalledWith({
      where: {
        status: "PUBLISHED",
        studyAnswerAttempts: { some: { profileId: "profile-1", isCorrect: false } },
      },
    });

    await repository.listPublished({
      filters: { favoriteOfProfileId: "profile-1" },
      offset: 0,
      limit: 20,
    });

    expect(questionCount).toHaveBeenLastCalledWith({
      where: {
        status: "PUBLISHED",
        studyFavorites: { some: { profileId: "profile-1" } },
      },
    });
  });

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
      OR: [
        { statement: { contains: "constitucional", mode: "insensitive" } },
        { area: { slug: { contains: "constitucional" } } },
        { topic: { slug: { contains: "constitucional" } } },
        { subtopic: { slug: { contains: "constitucional" } } },
      ],
      disciplineId: "discipline-1",
      type: "MULTIPLE_CHOICE",
      examination: {
        is: {
          boardId: "board-1",
          year: 2026,
        },
      },
    };

    expect(questionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expectedWhere,
        skip: 20,
        take: 10,
        orderBy: [
          { publishedAt: "desc" },
          { publicNumber: "desc" },
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

    expect(result).toEqual({
      items: [{ ...validPublicRow, isOriginal: false, textImageAssets: {} }],
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
        "00d64e4d-d040-40a5-94bb-76f7bd99216d",
      );

    expect(questionFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "00d64e4d-d040-40a5-94bb-76f7bd99216d",
          status: "PUBLISHED",
        },
      }),
    );

    await repository.findPublishedById("Q100001");

    expect(questionFindFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { publicNumber: 100001, status: "PUBLISHED" },
      }),
    );

    const callsBefore = questionFindFirst.mock.calls.length;
    expect(await repository.findPublishedById("question-1")).toBeNull();
    expect(questionFindFirst.mock.calls.length).toBe(callsBefore);

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
      areas: [{ id: "area-1", name: "Direitos Fundamentais", disciplineId: "discipline-1" }],
      // Topics outside an area (legacy) are left out of the cascade.
      topics: [{ id: "topic-1", name: "Direitos Individuais", areaId: "area-1" }],
      organizations: [{ id: "org-1", name: "Polícia Militar de Pernambuco", acronym: "PMPE" }],
      careerPositions: [{ id: "career-1", name: "Soldado" }],
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
        "00d64e4d-d040-40a5-94bb-76f7bd99216d",
      ),
    ).rejects.toThrow(
      "Published question question-1 is missing required taxonomy.",
    );
  });
});
