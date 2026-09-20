import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildCanonicalQuestionFingerprint,
  normalizeQuestionText,
} from "./question-fingerprint";

describe("question fingerprint", () => {
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
