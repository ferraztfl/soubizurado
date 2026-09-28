import { describe, expect, it } from "vitest";

import { parsePositionLines } from "./contest";
import {
  findExamDate,
  matchBoard,
  noticeExtractionSchema,
  statusFromRegistration,
  tidyName,
  toNoticeSuggestion,
} from "./notice-extraction";

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

  it("checks the AI against the notice text", () => {
    const extraction = noticeExtractionSchema.parse({
      organizationName: "TRIBUNAL DE JUSTIÇA DO ESTADO DO RIO GRANDE DO SUL (TJRS)",
      status: "NOTICE_PUBLISHED",
      hasReserveList: true,
      positions: [{ name: "JUIZ DE DIREITO SUBSTITUTO", vacancies: 30, reserve: true, requirements: "não informado" }],
      registrationStart: "2026-09-15",
      registrationEnd: "2026-10-14",
      examDate: null,
    });
    const noticeText = "12.4 A Prova Objetiva Seletiva está prevista para o dia 13 de dezembro de 2026 das 13h às\n18h.";
    const suggestion = toNoticeSuggestion(extraction, { noticeText, now: new Date("2026-09-29T12:00:00Z") });

    expect(suggestion.organizationName).toBe("Tribunal de Justiça do Estado do Rio Grande do Sul (TJRS)");
    expect(suggestion.status).toBe("REGISTRATION_OPEN");
    expect(suggestion.hasReserveList).toBe(false);
    expect(suggestion.examDate).toBe("2026-12-13");
    expect(suggestion.positionLines).toBe("Juiz de Direito Substituto | 30");
  });

  it("derives the status from the registration dates", () => {
    const now = new Date("2026-09-29T12:00:00Z");
    expect(statusFromRegistration("2026-10-01", "2026-10-30", now)).toBe("NOTICE_PUBLISHED");
    expect(statusFromRegistration("2026-09-01", "2026-09-20", now)).toBe("REGISTRATION_CLOSED");
    expect(statusFromRegistration("", "", now)).toBeNull();
  });

  it("finds the exam date in numeric or written form", () => {
    expect(findExamDate("Aplicação da Prova Objetiva Seletiva 13/12/2026")).toBe("2026-12-13");
    expect(findExamDate("A prova objetiva será em\n7 de março de 2027.")).toBe("2027-03-07");
    expect(findExamDate("Sem data aqui.")).toBe("");
    expect(tidyName("Instituto AOCP")).toBe("Instituto AOCP");
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
