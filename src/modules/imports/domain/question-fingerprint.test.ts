import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildCanonicalQuestionFingerprint,
  questionHtmlToDisplayText,
  questionHtmlToPlainText,
  normalizeQuestionText,
} from "./question-fingerprint";

describe("questionHtmlToDisplayText", () => {
  it("keeps paragraphs and line breaks while collapsing spaces", () => {
    expect(
      questionHtmlToDisplayText(
        "<p>**Título**</p><p>Primeiro   parágrafo<br/>linha 2</p><script>x</script><p> &amp; fim </p>",
      ),
    ).toBe("**Título**\n\nPrimeiro parágrafo\nlinha 2\n\n& fim");
  });

  it("keeps a table as one line per row with the cells joined", () => {
    expect(
      questionHtmlToDisplayText(
        "<p>Analise:</p><table><tbody><tr><td><p><br></p></td><td><p><strong>B</strong></p></td><td><p>C</p></td><td></td></tr>" +
          "<tr><td>3</td><td><p>A</p></td><td><p>6,5</p></td><td><p><br></p></td></tr><tr><td></td><td></td></tr></tbody></table><p>Fim</p>",
      ),
    ).toBe("Analise:\n\n| B | C\n3 | A | 6,5\n\nFim");
  });

  it("normalizes to the same fingerprint text as the plain version", () => {
    const html = "<p>A</p><p>B  c</p>";

    expect(normalizeQuestionText(questionHtmlToDisplayText(html))).toBe(
      normalizeQuestionText(html),
    );
  });
});

describe("question fingerprint", () => {
  it("converts provider HTML to readable plain text without lowercasing display content", () => {
    expect(
      questionHtmlToPlainText(
        "<p>Direito <strong>Administrativo</strong>&nbsp;Federal</p>",
      ),
    ).toBe(
      "Direito Administrativo Federal",
    );
  });

  it("normalizes HTML, entities, whitespace and casing", () => {
    expect(
      normalizeQuestionText(
        "<p>  Direito&nbsp;ADMINISTRATIVO </p>\n",
      ),
    ).toBe("direito administrativo");
  });

  it("produces the same fingerprint for formatting-only differences", () => {
    const first =
      buildCanonicalQuestionFingerprint({
        type: "MULTIPLE_CHOICE",
        supportTexts: [
          "<p>Leia o texto.</p>",
        ],
        statement:
          "<p>Assinale a alternativa CORRETA.</p>",
        alternatives: [
          {
            label: "A",
            content: "<p>Primeira opção</p>",
          },
          {
            label: "B",
            content: "<p>Segunda opção</p>",
          },
        ],
        mediaHashes: [],
      });

    const second =
      buildCanonicalQuestionFingerprint({
        type: "MULTIPLE_CHOICE",
        supportTexts: [
          " leia   o texto. ",
        ],
        statement:
          "ASSINALE a alternativa correta.",
        alternatives: [
          {
            label: "a",
            content: " Primeira opção ",
          },
          {
            label: "b",
            content: "SEGUNDA OPÇÃO",
          },
        ],
        mediaHashes: [],
      });

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes when the answer options change", () => {
    const base = {
      type: "MULTIPLE_CHOICE" as const,
      supportTexts: [] as const,
      statement: "Questão exemplo",
      mediaHashes: [] as const,
    };

    const first =
      buildCanonicalQuestionFingerprint({
        ...base,
        alternatives: [
          {
            label: "A",
            content: "Opção um",
          },
          {
            label: "B",
            content: "Opção dois",
          },
        ],
      });

    const second =
      buildCanonicalQuestionFingerprint({
        ...base,
        alternatives: [
          {
            label: "A",
            content: "Opção um",
          },
          {
            label: "B",
            content: "Opção três",
          },
        ],
      });

    expect(first).not.toBe(second);
  });
});
