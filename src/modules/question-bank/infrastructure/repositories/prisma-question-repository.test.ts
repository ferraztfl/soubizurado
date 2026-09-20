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
  PrismaQuestionRepository,
} from "./prisma-question-repository";

function createPrismaMock(
  found: Record<string, unknown> | null,
): {
  prisma: PrismaClient;
  findFirst: ReturnType<typeof vi.fn>;
} {
  const findFirst =
    vi.fn().mockResolvedValue(found);

  const prisma = {
    question: {
      findFirst,
    },
  } as unknown as PrismaClient;

  return {
    prisma,
    findFirst,
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
  it("loads answer data only for published question evaluation", async () => {
    const {
      prisma,
      findFirst,
    } = createPrismaMock(
      validPublishedRow,
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

    const call = findFirst.mock.calls[0]?.[0];

    expect(call?.select).toMatchObject({
      answerKeyStatus: true,
      correctTrueFalse: true,
      explanation: {
        select: {
          content: true,
        },
      },
      alternatives: {
        select: {
          isCorrect: true,
        },
      },
    });

    expect(result).toEqual({
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
    });
  });

  it("returns null when no published question matches the id", async () => {
    const {
      prisma,
    } = createPrismaMock(null);

    const repository =
      new PrismaQuestionRepository(prisma);

    await expect(
      repository.findPublishedById(
        "missing-question",
      ),
    ).resolves.toBeNull();
  });

  it("rejects published evaluation data without mandatory taxonomy", async () => {
    const invalidRow = {
      ...validPublishedRow,
      discipline: null,
    };

    const {
      prisma,
    } = createPrismaMock(invalidRow);

    const repository =
      new PrismaQuestionRepository(prisma);

    await expect(
      repository.findPublishedById(
        "question-1",
      ),
    ).rejects.toThrow(
      "Published question question-1 is missing required taxonomy.",
    );
  });
});
