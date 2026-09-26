import { describe, expect, it } from "vitest";

import {
  answerFor,
  parseAocpAnswerKey,
  parseAocpExam,
  readAocpLines,
  validateAocpExam,
} from "./aocp-pdf-parser";

const FONTS = `
<fontspec id="1" size="21" family="Arial" color="#000000"/>
<fontspec id="2" size="17" family="Arial" color="#000000"/>
<fontspec id="3" size="15" family="Arial" color="#000000"/>
<fontspec id="4" size="12" family="Arial" color="#000000"/>
<fontspec id="5" size="24" family="Arial" color="#000000"/>
<fontspec id="6" size="10" family="Arial" color="#000000"/>`;

function text(top: number, left: number, font: number, content: string): string {
  return `<text top="${top}" left="${left}" width="300" height="15" font="${font}">${content}</text>`;
}

function page(number: number, body: string): string {
  return `<page number="${number}" position="absolute" top="0" left="0" height="1262" width="892">${body}</page>`;
}

const SIMPLE_XML = `<?xml version="1.0"?>
<pdf2xml>
${FONTS}
${page(1, text(300, 64, 1, "<b>POLICIAL PENAL</b>"))}
${page(2, [
  text(56, 64, 4, "SEJUSP (MG)"),
  text(88, 64, 1, "<b>Língua Portuguesa</b>"),
  text(134, 129, 3, "<b>Amigos para o bem</b>"),
  text(200, 64, 3, "Costumamos dizer que é na hora do perrengue que se"),
  text(217, 64, 3, "conhece um amigo. Da mesma forma, vê-lo sofrer é perdê-"),
  text(234, 64, 3, "lo, impensável."),
  text(100, 468, 2, "<b>1 </b>"),
  text(120, 468, 3, "<b>O termo destacado em “É através do amor” pode ser</b>"),
  text(137, 468, 3, "<b>substituído por</b>"),
  text(172, 468, 2, "(A) "),
  text(171, 498, 3, "“porque temos”, <i>ad</i>"),
  text(189, 498, 3, "<i>referendum</i>."),
  text(210, 468, 2, "(B) "),
  text(209, 498, 3, "“por que temos”."),
  text(1195, 764, 4, "Página 2"),
].join("\n"))}
${page(3, [
  text(88, 64, 1, "<b>Noções de Direito</b>"),
  text(120, 64, 2, "<b>2 </b>"),
  text(140, 64, 3, "<b>Assinale a alternativa correta.</b>"),
  text(170, 64, 2, "(A) "),
  text(169, 94, 3, "Primeira."),
  text(190, 64, 2, "(B) "),
  text(189, 94, 3, "Segunda."),
  text(400, 64, 1, "<b>Redação</b>"),
  text(430, 64, 2, "<b>3 </b>"),
].join("\n"))}
</pdf2xml>`;

const BLOCK_XML = `<?xml version="1.0"?>
<pdf2xml>
${FONTS}
${page(1, "")}
${page(2, [
  text(89, 195, 5, "<b>BLOCO I</b>"),
  text(134, 64, 1, "<b>Língua Estrangeira - Inglês</b>"),
  text(170, 64, 2, "<b>1 </b>"),
  text(190, 64, 3, "<b>Choose one.</b>"),
  text(210, 64, 2, "(A) "),
  text(209, 94, 3, "Yes."),
  text(230, 64, 2, "(B) "),
  text(229, 94, 3, "No."),
  text(300, 64, 1, "<b>Língua Estrangeira - Espanhol</b>"),
  text(340, 64, 2, "<b>1 </b>"),
  text(360, 64, 3, "<b>Elija una.</b>"),
  text(380, 64, 2, "(A) "),
  text(379, 94, 3, "Sí."),
  text(400, 64, 2, "(B) "),
  text(399, 94, 3, "No."),
  text(450, 64, 1, "<b>Estatística</b>"),
  text(490, 64, 2, "<b>2 </b>"),
  text(510, 64, 3, "<b>Leia a tabela.</b>"),
  text(530, 480, 6, "<b>10</b>"),
  text(550, 64, 2, "(A) "),
  text(549, 94, 3, "Um."),
  text(570, 64, 2, "(B) "),
  text(569, 94, 3, "Dois."),
].join("\n"))}
</pdf2xml>`;

describe("parseAocpExam", () => {
  const exam = parseAocpExam(readAocpLines(SIMPLE_XML));

  it("finds sections and stops at the essay", () => {
    expect(exam.sections).toEqual(["Língua Portuguesa", "Noções de Direito"]);
    expect(exam.questions.map((question) => question.number)).toEqual([1, 2]);
  });

  it("builds support text with bold title and hyphenation joined", () => {
    expect(exam.questions[0]?.supportText).toBe(
      "**Amigos para o bem**\n\nCostumamos dizer que é na hora do perrengue que se conhece um amigo. Da mesma forma, vê-lo sofrer é perdê-lo, impensável.",
    );
  });

  it("keeps the label row order and italic spans", () => {
    const [question] = exam.questions;

    expect(question?.statement).toBe(
      "O termo destacado em “É através do amor” pode ser substituído por",
    );
    expect(question?.alternatives).toEqual([
      { label: "A", content: "“porque temos”, _ad_ _referendum_ ." },
      { label: "B", content: "“por que temos”." },
    ]);
    expect(question?.refersToHighlight).toBe(true);
  });

  it("resets the support text on a new section", () => {
    expect(exam.questions[1]).toMatchObject({
      section: "Noções de Direito",
      block: null,
      variant: 0,
      supportText: null,
      refersToHighlight: false,
    });
  });

  it("detects the alternatives count and validates it", () => {
    expect(validateAocpExam(exam)).toEqual([]);
    expect(validateAocpExam(exam, 4)).toContainEqual(
      expect.stringContaining('Questão 1: alternativas "AB"'),
    );
  });
});

describe("booklets with blocks and optional languages", () => {
  const exam = parseAocpExam(readAocpLines(BLOCK_XML));

  it("uses BLOCO as grouping and disciplines as sections", () => {
    expect(exam.sections).toEqual([
      "Língua Estrangeira - Inglês",
      "Língua Estrangeira - Espanhol",
      "Estatística",
    ]);
    expect(exam.questions.every((question) => question.block === "BLOCO I")).toBe(true);
  });

  it("numbers repeated questions as variants and ignores table digits", () => {
    expect(
      exam.questions.map((question) => [question.number, question.variant, question.section]),
    ).toEqual([
      [1, 0, "Língua Estrangeira - Inglês"],
      [1, 1, "Língua Estrangeira - Espanhol"],
      [2, 0, "Estatística"],
    ]);
    expect(validateAocpExam(exam)).toEqual([]);
  });
});

describe("parseAocpAnswerKey", () => {
  it("reads number/letter pairs and annulled questions", () => {
    const key = parseAocpAnswerKey("Questão\nGabarito\n 1\n A\n 2\n D\n58\nX\n60\nC\n");

    expect([...key.entries()]).toEqual([
      [1, ["A"]],
      [2, ["D"]],
      [58, ["ANNULLED"]],
      [60, ["C"]],
    ]);
  });

  it("keeps repeated numbers in order for optional-language variants", () => {
    const key = parseAocpAnswerKey("11 A 11 B 13 D 13 X");

    expect(answerFor(key, { number: 11, variant: 0 })).toBe("A");
    expect(answerFor(key, { number: 11, variant: 1 })).toBe("B");
    expect(answerFor(key, { number: 13, variant: 1 })).toBe("ANNULLED");
    expect(answerFor(key, { number: 14, variant: 0 })).toBeNull();
  });
});
