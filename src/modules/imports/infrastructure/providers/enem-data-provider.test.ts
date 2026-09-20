import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  EnemDataProvider,
} from "./enem-data-provider";

const examPayload = {
  title: "ENEM 2023",
  year: 2023,
  disciplines: [
    {
      label:
        "Linguagens, Códigos e suas Tecnologias",
      value: "linguagens",
    },
  ],
  languages: [
    {
      label: "Inglês",
      value: "ingles",
    },
  ],
  questions: [
    {
      title:
        "Questão 10 - ENEM 2023",
      index: 10,
      discipline: "linguagens",
      language: null,
    },
    {
      title:
        "Questão 1 - ENEM 2023",
      index: 1,
      discipline: "linguagens",
      language: "ingles",
    },
  ],
};

const textQuestionPayload = {
  title: "Questão 10 - ENEM 2023",
  index: 10,
  year: 2023,
  language: null,
  discipline: "linguagens",
  context:
    "Texto de apoio sem mídia.",
  files: [],
  correctAlternative: "E",
  alternativesIntroduction:
    "De acordo com o texto, assinale a alternativa correta.",
  alternatives: [
    {
      letter: "A",
      text: "Alternativa A",
      file: null,
      isCorrect: false,
    },
    {
      letter: "E",
      text: "Alternativa E",
      file: null,
      isCorrect: true,
    },
  ],
};

const imageQuestionPayload = {
  title: "Questão 1 - ENEM 2023",
  index: 1,
  year: 2023,
  language: "ingles",
  discipline: "linguagens",
  context:
    "![](https://enem.dev/2023/questions/1-ingles/image.png)",
  files: [
    "https://enem.dev/2023/questions/1-ingles/image.png",
  ],
  correctAlternative: "B",
  alternativesIntroduction:
    "Esse cartaz sugere que",
  alternatives: [
    {
      letter: "A",
      text: "Alternativa A",
      file: null,
      isCorrect: false,
    },
    {
      letter: "B",
      text: "Alternativa B",
      file: null,
      isCorrect: true,
    },
  ],
};

function jsonResponse(
  value: unknown,
): Response {
  return new Response(
    JSON.stringify(value),
    {
      status: 200,
      headers: {
        "Content-Type":
          "application/json",
      },
    },
  );
}

function createFetcher() {
  return vi.fn(
    async (
      input:
        | string
        | URL
        | Request,
    ): Promise<Response> => {
      const url = String(input);

      if (
        url.endsWith(
          "/2023/details.json",
        )
      ) {
        return jsonResponse(
          examPayload,
        );
      }

      if (
        url.endsWith(
          "/2023/questions/10/details.json",
        )
      ) {
        return jsonResponse(
          textQuestionPayload,
        );
      }

      if (
        url.endsWith(
          "/2023/questions/1-ingles/details.json",
        )
      ) {
        return jsonResponse(
          imageQuestionPayload,
        );
      }

      return new Response(
        "Not found",
        {
          status: 404,
        },
      );
    },
  );
}

describe("EnemDataProvider", () => {
  it("maps a text-only ENEM question into the provider-neutral contract", async () => {
    const provider =
      new EnemDataProvider({
        baseUrl:
          "https://example.test/public",
        fetcher: createFetcher(),
      });

    const result =
      await provider.listQuestions({
        limit: 1,
        examinationId:
          "enem-2023",
        includeAnswerKey: true,
      });

    expect(result.total).toBe(2);
    expect(result.nextCursor).toBe(
      "enem-2023-10",
    );
    expect(result.items).toHaveLength(
      1,
    );
    expect(result.items[0]).toMatchObject({
      externalId:
        "enem-2023-10",
      number: "10",
      statementHtml:
        "De acordo com o texto, assinale a alternativa correta.",
      answerKey: "E",
      examinationExternalIds: [
        "enem-2023",
      ],
      discipline:
        "Linguagens, Códigos e suas Tecnologias",
      topic: null,
      supportTextsHtml: [
        "Texto de apoio sem mídia.",
      ],
      attachmentUrls: [],
      hasImages: false,
      hasAnswerKey: true,
      hasSupportText: true,
    });

    expect(
      result.items[0]?.alternatives,
    ).toEqual([
      {
        label: "A",
        contentHtml:
          "Alternativa A",
        imageUrls: [],
      },
      {
        label: "E",
        contentHtml:
          "Alternativa E",
        imageUrls: [],
      },
    ]);
  });

  it("marks image-dependent ENEM questions for media review", async () => {
    const provider =
      new EnemDataProvider({
        baseUrl:
          "https://example.test/public",
        fetcher: createFetcher(),
      });

    const result =
      await provider.listQuestions({
        limit: 1,
        examinationId:
          "enem-2023",
        afterId:
          "enem-2023-10",
      });

    expect(result.nextCursor).toBeNull();
    expect(result.items[0]).toMatchObject({
      externalId:
        "enem-2023-1-ingles",
      answerKey: "B",
      hasImages: true,
      attachmentUrls: [
        "https://enem.dev/2023/questions/1-ingles/image.png",
      ],
    });
  });

  it("returns ENEM examination metadata without inventing an examining board", async () => {
    const provider =
      new EnemDataProvider();

    await expect(
      provider.getExamination(
        "enem-2023",
      ),
    ).resolves.toEqual({
      externalId:
        "enem-2023",
      title: "ENEM 2023",
      slugPrefix: "enem",
      organization: "INEP",
      careerPosition: null,
      year: 2023,
      board: null,
      alternativeType:
        "MULTIPLA_ESCOLHA",
    });
  });

  it("supports direct lookup by stable external id", async () => {
    const provider =
      new EnemDataProvider({
        baseUrl:
          "https://example.test/public",
        fetcher: createFetcher(),
      });

    const result =
      await provider.listQuestions({
        limit: 100,
        externalId:
          "enem-2023-1-ingles",
        examinationId:
          "enem-2023",
      });

    expect(result.items).toHaveLength(
      1,
    );
    expect(
      result.items[0]?.externalId,
    ).toBe(
      "enem-2023-1-ingles",
    );
  });
});
