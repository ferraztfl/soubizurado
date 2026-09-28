import { describe, expect, it } from "vitest";

import { noticeExtractionSchema } from "./notice-extraction";
import {
  anchoredExcerpt,
  cleanNoticeText,
  detectBoard,
  groundExtraction,
  mergeNoticeFacts,
  readNoticeTextFacts,
} from "./notice-text-facts";

// Excerpts of the real PMAL 2026 notice (browser-printed PDF).
const PMAL = `28/09/2026, 17:43                           Ed_1_2026_PMAL_Abertura_Atualizado_Ret_Ed_13

ESTADO DE ALAGOAS

SECRETARIA DE ESTADO DO PLANEJAMENTO, GESTÃO E PATRIMÔNIO DO ESTADO DE ALAGOAS (SEPLAG/AL)

POLÍCIA MILITAR DO ESTADO DE ALAGOAS (PMAL)

EDITAL Nº 1 – PMAL, DE 19 DE MARÇO DE 2026

1.1 O concurso público será regido por este edital e executado pelo Centro Brasileiro de Pesquisa em Avaliação e
Seleção e de Promoção de Eventos (Cebraspe), pela SEPLAG/AL e pela PMAL.
 a) provas objetivas, de caráter eliminatório e classificatório, de responsabilidade do Cebraspe;
 b) prova discursiva, de caráter eliminatório e classificatório, de responsabilidade do Cebraspe;
 c) teste de aptidão física, de caráter eliminatório, de responsabilidade da PMAL;
1.3 As provas objetivas e a prova discursiva, para todos os candidatos, serão realizadas nas cidades de Arapiraca/AL e
Maceió/AL.
https://cdn.cebraspe.org.br/concursos/pm_al_26/arquivos/C7F9594FD07DC57DCD13724F11B04A01… 1/84
2.1 CARGO 1: OFICIAL DE ESTADO-MAIOR
II – condição alcançada como Aspirante, após a conclusão do CFO: R$ 11.563,77.
2.2 CARGO 2: SOLDADO DO QUADRO DE PRAÇAS
II – condição alcançada como Soldado, após a conclusão do CFP: R$ 6.067,51.
A PMAL e o Cebraspe. PMAL PMAL.
6.1 TAXA: R$ 150,00.
`;

const BOARDS = ["AOCP", "Cebraspe", "FGV", "Instituto AOCP"];

describe("notice text facts", () => {
  it("reads the header data with rules", () => {
    const text = cleanNoticeText(PMAL);
    expect(text).not.toContain("17:43");
    expect(text).not.toContain("1/84");

    // pdftotext on Windows: CRLF line ends and a form feed at each page.
    const windows = cleanNoticeText(PMAL.split("\n").join("\r\n").replace("28/09/2026", "\f28/09/2026"));
    expect(windows).not.toContain("17:43");
    expect(windows).not.toContain("1/84");

    const facts = readNoticeTextFacts(text, BOARDS);
    expect(facts.organization).toEqual({ name: "Polícia Militar do Estado de Alagoas (PMAL)", acronym: "PMAL" });
    expect(facts.stateCode).toBe("AL");
    expect(facts.year).toBe(2026);
    expect(facts.boardName).toBe("Cebraspe");
    expect(facts.feeText).toBe("R$ 150,00");
    expect(facts.examLocations).toBe("Arapiraca/AL e Maceió/AL");
    expect(facts.stages).toEqual(["Provas objetivas", "Prova discursiva", "Teste de aptidão física"]);
  });

  it("tells AOCP from Instituto AOCP", () => {
    expect(detectBoard("Organização: Instituto AOCP. O Instituto AOCP publicará.", BOARDS)).toBe("Instituto AOCP");
    expect(detectBoard("Banca AOCP. A AOCP divulgará.", BOARDS)).toBe("AOCP");
    expect(detectBoard("Fundação Getulio Vargas", BOARDS)).toBe("FGV");
  });

  it("drops what the notice does not say and rebuilds the name", () => {
    const text = cleanNoticeText(PMAL);
    const ai = noticeExtractionSchema.parse({
      name: "Concurso TJRS Juiz 2026",
      organizationName: "Polícia Militar de Pernambuco",
      boardName: "FGV",
      salaryMin: "6.067,51",
      salaryMax: "99.999,99",
      positions: [
        { name: "Oficial de Estado-Maior", vacancies: 30, salary: "11.563,77" },
        { name: "Juiz de Direito Substituto", vacancies: 30 },
      ],
    });
    const { extraction, dropped } = groundExtraction(ai, text);
    expect(extraction.organizationName).toBeNull();
    expect(extraction.boardName).toBeNull();
    expect(extraction.salaryMin).toBe("6.067,51");
    expect(extraction.salaryMax).toBeNull();
    expect(extraction.positions?.map((position) => position.name)).toEqual(["Oficial de Estado-Maior"]);
    expect(dropped).toContain('cargo "Juiz de Direito Substituto"');

    const merged = mergeNoticeFacts(extraction, readNoticeTextFacts(text, BOARDS));
    expect(merged.name).toBe("Concurso PMAL 2026");
    expect(merged.boardName).toBe("Cebraspe");
  });

  it("keeps the anchor lines for the AI", () => {
    const excerpt = anchoredExcerpt(cleanNoticeText(PMAL), 5_000);
    expect(excerpt).toContain("R$ 11.563,77");
    expect(excerpt).toContain("6.1 TAXA: R$ 150,00.");
  });
});
