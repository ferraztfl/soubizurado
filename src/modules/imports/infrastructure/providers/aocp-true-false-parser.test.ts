import { describe, expect, it } from "vitest";

import type { AocpLine } from "./aocp-pdf-parser";
import {
  findRoleAnswers,
  parseAocpTrueFalseExam,
  parseSectionRanges,
  parseTrueFalseAnswerKeyBlocks,
  TRUE_FALSE_FORMAT,
  validateTrueFalseExam,
} from "./aocp-true-false-parser";

const COVER = [
  "UNIVERSIDADE FEDERAL DA BAHIA",
  "TRADUTOR E INTÉRPRETE DE LINGUAGEM DE SINAIS - LIBRAS",
  "Nome do Candidato",
  "Inscrição",
  "Português",
  "",
  "COMPOSIÇÃO DO CADERNO 01 a 02",
  "",
  "Administração Pública",
  "",
  "03 a 03",
  "Leia atentamente cada item da prova objetiva e o julgue como VERDADEIRO ou FALSO, preenchendo...",
].join("\n");

function line(overrides: Partial<AocpLine> & Pick<AocpLine, "text">): AocpLine {
  return {
    page: 2,
    top: 100,
    left: 468,
    size: 17,
    bold: false,
    column: 1,
    columnLeft: 468,
    image: null,
    ...overrides,
  };
}

const LINES: AocpLine[] = [
  line({ text: "Texto 1 – itens 01 a 02", bold: true, left: 147, columnLeft: 51, column: 0 }),
  line({ text: "A insana mania de economizar", bold: true, left: 70, columnLeft: 51, column: 0 }),
  line({ text: "Existe uma grande diferença entre", bold: true, left: 72, columnLeft: 51, column: 0 }),
  line({ text: "oportunidade e oportunismo.", bold: true, left: 51, columnLeft: 51, column: 0 }),
  line({ text: "Segundo o autor, o vício é antigo.", bold: true, left: 72, columnLeft: 51, column: 0 }),
  line({ text: "Em relação ao Texto 1, julgue, como", bold: true, left: 510 }),
  line({ text: "VERDADEIRO ou FALSO, os itens a", bold: true, left: 510 }),
  line({ text: "seguir.", bold: true, left: 510 }),
  line({ text: "1. A crítica central do texto está no fato de que" }),
  line({ text: "o brasileiro compra produtos falsificados.", left: 510 }),
  line({ text: "2. Em “Quantas vezes subiu o seguro?”, o termo em", page: 3, top: 56, left: 60, columnLeft: 60, column: 0 }),
  line({ text: "destaque é o núcleo do sujeito.", page: 3, left: 102, columnLeft: 60, column: 0 }),
  line({ text: "A D M I N I S T R A Ç Ã O  P Ú B L I C A", bold: true, page: 3, left: 306, columnLeft: 60, column: 0 }),
  line({ text: "Acerca do acesso aos cargos públicos, julgue,", bold: true, page: 3, left: 102, columnLeft: 60, column: 0 }),
  line({ text: "como VERDADEIRO ou FALSO, o item a seguir.", bold: true, page: 3, left: 102, columnLeft: 60, column: 0 }),
  line({ text: "3. Os cargos públicos são acessíveis aos estrangeiros, na forma da lei.", page: 3, left: 60, columnLeft: 60, column: 0 }),
];

describe("AOCP true/false booklet", () => {
  it("detects the format and reads the section ranges from the cover", () => {
    expect(TRUE_FALSE_FORMAT.test(COVER)).toBe(true);
    expect(parseSectionRanges(COVER)).toEqual([
      { name: "Português", from: 1, to: 2 },
      { name: "Administração Pública", from: 3, to: 3 },
    ]);
  });

  it("splits items, group commands, shared texts and sections", () => {
    const exam = parseAocpTrueFalseExam(LINES, parseSectionRanges(COVER));

    expect(exam.items.map((item) => [item.number, item.section])).toEqual([
      [1, "Português"],
      [2, "Português"],
      [3, "Administração Pública"],
    ]);

    const [first, second, third] = exam.items;

    expect(first!.command).toBe("Em relação ao Texto 1, julgue, como VERDADEIRO ou FALSO, os itens a seguir.");
    expect(first!.statement).toBe("A crítica central do texto está no fato de que o brasileiro compra produtos falsificados.");
    // Bold paragraphs of the shared text stay in the text, not as a command.
    expect(first!.supportText).toContain("Segundo o autor, o vício é antigo.");
    expect(first!.supportText).toContain("\n\nExiste uma grande diferença entre oportunidade e oportunismo.");
    expect(second!.supportText).toBe(first!.supportText);
    expect(second!.refersToHighlight).toBe(true);
    expect(third!.supportText).toBeNull();
    expect(third!.command).toBe("Acerca do acesso aos cargos públicos, julgue, como VERDADEIRO ou FALSO, o item a seguir.");
    expect(validateTrueFalseExam(exam, 3)).toEqual([]);
    expect(validateTrueFalseExam(exam, 85)).toContain("O caderno anuncia 85 itens, mas foram lidos 3.");
  });
});

describe("true/false answer key with every role", () => {
  const KEY = [
    "pcimarkpci abc",
    "TÉCNICO EM SEGURANÇA DO TRABALHO 01 02 03 04 05 FVV F F",
    "TRADUTOR E INTÉRPRETE DE LINGUAGEM DE SINAIS - LIBRAS 01 02 03 04 05 F VXV",
    "F",
    "www.pciconcursos.com.br",
    "NÍVEL SUPERIOR – CLASSE E - TARDE ADMINISTRADOR",
    "01 02 03 V F F",
    "ANALISTA DE TI/ANALISTA DE DESENVOLVIMENTO 01 02 V V",
    "ANALISTA DE TI / ANALISTA DE INFRAESTRUTURA 01 02 F F",
  ].join("\n");

  it("reads each block, joining irregularly spaced letters (X = annulled)", () => {
    const blocks = parseTrueFalseAnswerKeyBlocks(KEY);

    expect(blocks.map((block) => block.answers.size)).toEqual([5, 5, 3, 2, 2]);

    const libras = findRoleAnswers(blocks, "TRADUTOR E INTÉRPRETE DE LINGUAGEM DE SINAIS - LIBRAS");

    expect(libras.matches).toHaveLength(1);
    expect([...libras.answers!.entries()]).toEqual([
      [1, "F"],
      [2, "V"],
      [3, "ANNULLED"],
      [4, "V"],
      [5, "F"],
    ]);
  });

  it("matches a role heading that carries a level prefix", () => {
    const blocks = parseTrueFalseAnswerKeyBlocks(KEY);

    expect(findRoleAnswers(blocks, "Administrador").answers?.get(1)).toBe("V");
    expect(findRoleAnswers(blocks, "Tradutor").answers).toBeNull();
  });

  it("reports ambiguity instead of guessing", () => {
    const blocks = parseTrueFalseAnswerKeyBlocks(`${KEY}\nADMINISTRADOR 01 02 03 F F F`);

    expect(findRoleAnswers(blocks, "ADMINISTRADOR")).toEqual({
      answers: null,
      matches: ["NÍVEL SUPERIOR – CLASSE E - TARDE ADMINISTRADOR", "ADMINISTRADOR"],
    });
  });
});
