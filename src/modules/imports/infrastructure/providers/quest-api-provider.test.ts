import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  QuestApiProvider,
} from "./quest-api-provider";

describe("QuestApiProvider", () => {
  it("maps a Quest API page into provider-neutral candidates", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            total: 1,
            page: 1,
            per_page: 1,
            next_cursor: "2511300125",
            items: [
              {
                id: "2511300125",
                numero: "41",
                enunciado:
                  "<p>Compete privativamente...</p>",
                alternativas: [
                  {
                    letra: "C",
                    texto: "<p>Certo</p>",
                    imagens: [],
                  },
                  {
                    letra: "E",
                    texto: "<p>Errado</p>",
                    imagens: [],
                  },
                ],
                gabarito: "C",
                provas: ["2597585"],
                classificacao: {
                  materia:
                    "Direito Constitucional",
                  assunto:
                    "Controle de constitucionalidade",
                },
                textos_associados: [
                  "<p>Com base na CF...</p>",
                ],
                anexos: [],
                sinalizadores: {
                  tem_imagem: false,
                  tem_gabarito: true,
                  tem_texto_associado: true,
                },
              },
            ],
          },
          meta: {
            correlationId: "corr-1",
            timestamp:
              "2026-07-31T22:45:15.751Z",
          },
        }),
        {
          status: 200,
          headers: {
            "content-type":
              "application/json",
          },
        },
      ),
    );

    const provider = new QuestApiProvider({
      apiKey: "qk_test",
      fetcher,
    });

    const result = await provider.listQuestions({
      limit: 1,
      includeAnswerKey: true,
      requireAnswerKey: true,
    });

    expect(fetcher).toHaveBeenCalledOnce();

    const requestUrl = String(
      fetcher.mock.calls[0]?.[0],
    );

    expect(requestUrl).toContain(
      "/v2/questoes?",
    );
    expect(requestUrl).toContain("per_page=1");
    expect(requestUrl).toContain(
      "include_gabarito=true",
    );
    expect(requestUrl).toContain(
      "tem_gabarito=true",
    );

    expect(result).toEqual({
      total: 1,
      nextCursor: "2511300125",
      correlationId: "corr-1",
      items: [
        {
          externalId: "2511300125",
          number: "41",
          statementHtml:
            "<p>Compete privativamente...</p>",
          alternatives: [
            {
              label: "C",
              contentHtml: "<p>Certo</p>",
              imageUrls: [],
            },
            {
              label: "E",
              contentHtml: "<p>Errado</p>",
              imageUrls: [],
            },
          ],
          answerKey: "C",
          examinationExternalIds: [
            "2597585",
          ],
          discipline:
            "Direito Constitucional",
          topic:
            "Controle de constitucionalidade",
          supportTextsHtml: [
            "<p>Com base na CF...</p>",
          ],
          attachmentUrls: [],
          hasImages: false,
          hasAnswerKey: true,
          hasSupportText: true,
          rawPayload: expect.any(Object),
        },
      ],
    });
  });

  it("loads one question directly by id without using the search endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: "2511300125",
            numero: "41",
            enunciado:
              "<p>Compete privativamente...</p>",
            alternativas: [
              {
                letra: "C",
                texto: "<p>Certo</p>",
                imagens: [],
              },
              {
                letra: "E",
                texto: "<p>Errado</p>",
                imagens: [],
              },
            ],
            gabarito: "C",
            provas: ["2597585"],
            classificacao: {
              materia:
                "Direito Constitucional",
              assunto:
                "Controle de constitucionalidade",
            },
            textos_associados: [],
            anexos: [],
            sinalizadores: {
              tem_imagem: false,
              tem_gabarito: true,
              tem_texto_associado: false,
            },
          },
          meta: {
            correlationId: "direct-1",
            timestamp:
              "2026-09-20T00:00:00.000Z",
          },
        }),
        {
          status: 200,
          headers: {
            "content-type":
              "application/json",
          },
        },
      ),
    );

    const provider = new QuestApiProvider({
      apiKey: "qk_test",
      fetcher,
    });

    const result = await provider.listQuestions({
      limit: 1,
      externalId: "2511300125",
      includeAnswerKey: true,
    });

    expect(result.total).toBe(1);
    expect(result.nextCursor).toBeNull();
    expect(result.correlationId).toBe(
      "direct-1",
    );
    expect(result.items[0]?.externalId).toBe(
      "2511300125",
    );

    const requestUrl = String(
      fetcher.mock.calls[0]?.[0],
    );

    expect(requestUrl).toContain(
      "/v2/questoes/2511300125",
    );
    expect(requestUrl).not.toContain(
      "alternative_type",
    );
  });

  it("loads an examination and merges its official answer key into local candidates", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              prova: {
                id: "2511693",
                orgao: "A.C.Camargo Cancer Center",
                cargo:
                  "Residência em Nutrição - Área: Oncologia",
                ano: "2025",
                banca: "VUNESP",
                alternative_type:
                  "MULTIPLA_ESCOLHA",
              },
              total_questoes: "2",
              items: [
                {
                  id: "q-1",
                  numero: "1",
                  enunciado:
                    "<p>Questão um</p>",
                  alternativas: [
                    {
                      letra: "A",
                      texto: "<p>A</p>",
                      imagens: [],
                    },
                    {
                      letra: "B",
                      texto: "<p>B</p>",
                      imagens: [],
                    },
                  ],
                  gabarito: null,
                  provas: ["2511693"],
                  classificacao: {
                    materia: "Nutrição",
                    assunto: "Oncologia",
                  },
                  textos_associados: null,
                  anexos: null,
                  sinalizadores: null,
                },
                {
                  id: "q-2",
                  numero: "2",
                  enunciado:
                    "<p>Questão dois</p>",
                  alternativas: [
                    {
                      letra: "A",
                      texto: "<p>A</p>",
                      imagens: [],
                    },
                    {
                      letra: "B",
                      texto: "<p>B</p>",
                      imagens: [],
                    },
                  ],
                  gabarito: null,
                  provas: ["2511693"],
                  classificacao: {
                    materia: "Nutrição",
                    assunto: "Oncologia",
                  },
                  textos_associados: [],
                  anexos: [],
                  sinalizadores: {
                    tem_imagem: false,
                    tem_gabarito: false,
                    tem_texto_associado: false,
                  },
                },
              ],
            },
            meta: {
              correlationId: "exam-content-1",
              timestamp:
                "2026-09-20T00:00:00.000Z",
            },
          }),
          {
            status: 200,
            headers: {
              "content-type":
                "application/json",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              prova: {
                id: "2511693",
                orgao: "A.C.Camargo Cancer Center",
                cargo:
                  "Residência em Nutrição - Área: Oncologia",
                ano: "2025",
                banca: "VUNESP",
                alternative_type:
                  "MULTIPLA_ESCOLHA",
              },
              gabaritos: [
                {
                  questao_id: "q-1",
                  numero: "1",
                  gabarito: "B",
                },
                {
                  questao_id: "q-2",
                  numero: "2",
                  gabarito: "A",
                },
              ],
            },
            meta: {
              correlationId: "exam-key-1",
              timestamp:
                "2026-09-20T00:00:00.000Z",
            },
          }),
          {
            status: 200,
            headers: {
              "content-type":
                "application/json",
            },
          },
        ),
      );

    const provider = new QuestApiProvider({
      apiKey: "qk_test",
      fetcher,
    });

    const result = await provider.listQuestions({
      limit: 10,
      examinationId: "2511693",
      includeAnswerKey: true,
      requireAnswerKey: true,
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[0]?.[0]))
      .toContain("/v1/provas/2511693");
    expect(String(fetcher.mock.calls[1]?.[0]))
      .toContain(
        "/v1/provas/2511693/gabarito",
      );

    expect(result).toMatchObject({
      total: 2,
      nextCursor: null,
      correlationId: "exam-content-1",
    });

    expect(
      result.items.map((item) => ({
        id: item.externalId,
        answerKey: item.answerKey,
        hasAnswerKey: item.hasAnswerKey,
      })),
    ).toEqual([
      {
        id: "q-1",
        answerKey: "B",
        hasAnswerKey: true,
      },
      {
        id: "q-2",
        answerKey: "A",
        hasAnswerKey: true,
      },
    ]);
  });

  it("lists current examinations so imports do not depend on stale documentation ids", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            total: 2,
            page: 1,
            per_page: 2,
            items: [
              {
                id: "exam-100",
                orgao: "Órgão A",
                cargo: "Cargo A",
                ano: "2025",
                banca: "FGV",
                alternative_type:
                  "MULTIPLA_ESCOLHA",
                total_questoes: 80,
              },
              {
                id: "exam-200",
                orgao: "Órgão B",
                cargo: "Cargo B",
                ano: "2025",
                banca: "CEBRASPE",
                alternative_type:
                  "CERTO_ERRADO",
                total_questoes: 20,
              },
            ],
          },
          meta: {
            correlationId: "exams-1",
            timestamp:
              "2026-09-20T00:00:00.000Z",
          },
        }),
        {
          status: 200,
          headers: {
            "content-type":
              "application/json",
          },
        },
      ),
    );

    const provider = new QuestApiProvider({
      apiKey: "qk_test",
      fetcher,
    });

    await expect(
      provider.listExaminations({
        limit: 2,
        year: "2025",
      }),
    ).resolves.toEqual({
      total: 2,
      correlationId: "exams-1",
      items: [
        {
          externalId: "exam-100",
          organization: "Órgão A",
          careerPosition: "Cargo A",
          year: 2025,
          board: "FGV",
          alternativeType:
            "MULTIPLA_ESCOLHA",
          totalQuestions: 80,
        },
        {
          externalId: "exam-200",
          organization: "Órgão B",
          careerPosition: "Cargo B",
          year: 2025,
          board: "CEBRASPE",
          alternativeType:
            "CERTO_ERRADO",
          totalQuestions: 20,
        },
      ],
    });

    const requestUrl = String(
      fetcher.mock.calls[0]?.[0],
    );

    expect(requestUrl).toContain(
      "/v1/provas?",
    );
    expect(requestUrl).toContain(
      "ano=2025",
    );
    expect(requestUrl).toContain(
      "per_page=2",
    );
  });

  it("loads lightweight examination metadata by external id", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            total: 1,
            page: 1,
            per_page: 10,
            items: [
              {
                id: "2554075",
                orgao: "TRF 1",
                cargo: "Juiz Federal Substituto",
                ano: "2025",
                banca: "FGV",
                alternative_type:
                  "MULTIPLA_ESCOLHA",
                total_questoes: 100,
              },
            ],
          },
          meta: {
            correlationId: "corr-proof-1",
            timestamp:
              "2026-07-31T22:49:04.691Z",
          },
        }),
        {
          status: 200,
          headers: {
            "content-type":
              "application/json",
          },
        },
      ),
    );

    const provider = new QuestApiProvider({
      apiKey: "qk_test",
      fetcher,
    });

    await expect(
      provider.getExamination(
        "2554075",
      ),
    ).resolves.toEqual({
      externalId: "2554075",
      organization: "TRF 1",
      careerPosition:
        "Juiz Federal Substituto",
      year: 2025,
      board: "FGV",
      alternativeType:
        "MULTIPLA_ESCOLHA",
    });

    const requestUrl = String(
      fetcher.mock.calls[0]?.[0],
    );

    expect(requestUrl).toContain(
      "/v1/provas?",
    );
    expect(requestUrl).toContain(
      "codigo=2554075",
    );
  });

  it("retries transient 503 responses before succeeding", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            statusCode: 503,
            message: "Service Unavailable",
            correlationId: "corr-503",
          }),
          {
            status: 503,
            headers: {
              "content-type":
                "application/json",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              total: 0,
              page: 1,
              per_page: 1,
              next_cursor: null,
              items: [],
            },
            meta: {
              correlationId: "corr-ok",
              timestamp:
                "2026-09-20T00:00:00.000Z",
            },
          }),
          {
            status: 200,
            headers: {
              "content-type":
                "application/json",
            },
          },
        ),
      );
    const sleep = vi
      .fn()
      .mockResolvedValue(undefined);

    const provider = new QuestApiProvider({
      apiKey: "qk_test",
      fetcher,
      sleep,
    });

    await expect(
      provider.listQuestions({
        limit: 1,
        includeAnswerKey: true,
      }),
    ).resolves.toMatchObject({
      total: 0,
      items: [],
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledOnce();
  });

  it("reads account quota without consuming question credits", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            planCode: "starter",
            periodStart:
              "2026-09-01T00:00:00.000Z",
            periodEnd:
              "2026-10-01T00:00:00.000Z",
            used: 30,
            quotaPerCycle: 10000,
            remaining: 9970,
            percentUsed: 0.3,
            unlimited: false,
          },
          meta: {
            correlationId: "quota-1",
            timestamp:
              "2026-09-20T00:00:00.000Z",
          },
        }),
        {
          status: 200,
          headers: {
            "content-type":
              "application/json",
          },
        },
      ),
    );

    const provider = new QuestApiProvider({
      apiKey: "qk_test",
      fetcher,
    });

    await expect(
      provider.getQuota(),
    ).resolves.toEqual({
      planCode: "starter",
      periodStart:
        "2026-09-01T00:00:00.000Z",
      periodEnd:
        "2026-10-01T00:00:00.000Z",
      used: 30,
      quotaPerCycle: 10000,
      remaining: 9970,
      percentUsed: 0.3,
      unlimited: false,
      correlationId: "quota-1",
    });

    expect(String(fetcher.mock.calls[0]?.[0]))
      .toContain("/v2/quota");
  });

  it("fails clearly when the provider returns a non-success response", async () => {
    const provider = new QuestApiProvider({
      apiKey: "qk_test",
      fetcher: vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            message: "Quota esgotada",
          }),
          {
            status: 402,
            headers: {
              "content-type":
                "application/json",
            },
          },
        ),
      ),
    });

    await expect(
      provider.listQuestions({
        limit: 1,
        includeAnswerKey: true,
      }),
    ).rejects.toThrow(
      "Quest API request failed with status 402: Quota esgotada",
    );
  });
});
