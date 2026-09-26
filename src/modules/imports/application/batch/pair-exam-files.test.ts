import { describe, expect, it } from "vitest";

import { pairExamFiles } from "./pair-exam-files";

describe("pairExamFiles", () => {
  it("pairs one booklet and one answer key per subfolder", () => {
    expect(
      pairExamFiles([
        "pmpe-soldado/caderno.pdf",
        "pmpe-soldado/gabarito definitivo.pdf",
        "sejusp/prova.pdf",
        "sejusp/Gabarito.PDF",
        "sejusp/leia-me.txt",
      ]),
    ).toEqual({
      pairs: [
        { label: "pmpe-soldado", booklet: "pmpe-soldado/caderno.pdf", answerKey: "pmpe-soldado/gabarito definitivo.pdf" },
        { label: "sejusp", booklet: "sejusp/prova.pdf", answerKey: "sejusp/Gabarito.PDF" },
      ],
      unpaired: [],
    });
  });

  it("uses a single root answer key for folders without one (multi-role keys)", () => {
    const result = pairExamFiles([
      "gabaritos_pos_recursos.pdf",
      "libras/tradutor_libras.pdf",
      "administrador/administrador.pdf",
    ]);

    expect(result.pairs.map((pair) => [pair.label, pair.answerKey])).toEqual([
      ["administrador", "gabaritos_pos_recursos.pdf"],
      ["libras", "gabaritos_pos_recursos.pdf"],
    ]);
    expect(result.unpaired).toEqual([]);
  });

  it("pairs loose files by name", () => {
    const result = pairExamFiles([
      "87762278.pdf",
      "87762278-gabarito.pdf",
      "gabarito_camacari.pdf",
      "camacari.pdf",
      "sozinho.pdf",
      "gabarito-orfao.pdf",
    ]);

    expect(result.pairs).toEqual([
      { label: "87762278", booklet: "87762278.pdf", answerKey: "87762278-gabarito.pdf" },
      { label: "camacari", booklet: "camacari.pdf", answerKey: "gabarito_camacari.pdf" },
    ]);
    expect(result.unpaired).toEqual([
      { file: "sozinho.pdf", reason: "Gabarito correspondente não encontrado." },
      { file: "gabarito-orfao.pdf", reason: "Gabarito sem caderno correspondente." },
    ]);
  });

  it("reports folders it cannot pair", () => {
    const result = pairExamFiles([
      "a/prova.pdf",
      "b/gabarito-1.pdf",
      "b/gabarito-2.pdf",
      "b/prova.pdf",
      "c/gabarito.pdf",
    ]);

    expect(result.pairs).toEqual([]);
    expect(result.unpaired.map((entry) => entry.reason)).toEqual([
      "Pasta sem gabarito.",
      "Mais de um gabarito na pasta.",
      "Mais de um gabarito na pasta.",
      "Mais de um gabarito na pasta.",
      "Pasta sem caderno de questões.",
    ]);
  });
});
