import { describe, expect, it } from "vitest";

import { parsePositionLines } from "./contest";
import { matchBoard, noticeExtractionSchema, toNoticeSuggestion } from "./notice-extraction";

describe("toNoticeSuggestion", () => {
  it("turns the AI answer into form values", () => {
    const extraction = noticeExtractionSchema.parse({
      name: "Concurso PMPE 2026",
      organizationName: "Polícia Militar de Pernambuco (PMPE)",
      stateCode: "pe",
      boardName: "Instituto AOCP",
      status: "REGISTRATION_OPEN",
      vacancies: null,
      positions: [
        { name: "Soldado", vacancies: 1250, reserve: false, salary: "R$ 5.617,92", education: "Médio", requirements: "CNH B" },
        { name: "Oficial", vacancies: 70, reserve: true, salary: "12937,33", education: "superior" },
      ],
      registrationStart: "2026-10-20",
      registrationEnd: "2026-11-30",
      examDate: "31/01/2027",
      feeText: "R$ 120,00",
      stages: ["Prova objetiva", " ", "TAF"],
      summary: "Resumo.",
      news: { title: "Saiu o edital da PMPE", excerpt: "Resumo curto.", body: "Texto da notícia." },
    });

    const suggestion = toNoticeSuggestion(extraction);

    expect(suggestion.stateCode).toBe("PE");
    expect(suggestion.vacancies).toBe("1320");
    expect(suggestion.hasReserveList).toBe(true);
    expect(suggestion.educationLevels).toEqual(["MEDIO", "SUPERIOR"]);
    expect(suggestion.examDate).toBe("");
    expect(suggestion.stages).toBe("Prova objetiva\nTAF");
    expect(suggestion.news?.title).toBe("Saiu o edital da PMPE");

    const positions = parsePositionLines(suggestion.positionLines);
    expect(positions.ok && positions.positions.map((position) => [position.name, position.salaryCents])).toEqual([
      ["Soldado", 561792],
      ["Oficial", 1293733],
    ]);
  });

  it("falls back safely on unknown values", () => {
    const suggestion = toNoticeSuggestion(noticeExtractionSchema.parse({ status: "ABERTO", stateCode: "XX", salaryMax: "muito" }));
    expect(suggestion.status).toBe("NOTICE_PUBLISHED");
    expect(suggestion.stateCode).toBeNull();
    expect(suggestion.salaryMax).toBe("");
    expect(suggestion.warnings.length).toBeGreaterThan(0);
  });

  it("matches boards exactly", () => {
    const boards = [
      { id: "1", name: "AOCP" },
      { id: "2", name: "Instituto AOCP" },
    ];
    expect(matchBoard(boards, "instituto aocp")?.id).toBe("2");
    expect(matchBoard(boards, "AOCP")?.id).toBe("1");
    expect(matchBoard(boards, "Fundação AOCP")).toBeNull();
  });
});
