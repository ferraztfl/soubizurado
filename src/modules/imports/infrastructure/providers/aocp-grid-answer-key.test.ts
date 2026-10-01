import { describe, expect, it } from "vitest";

import { findGridKeyBlock, looksLikeGridAnswerKey, parseAocpGridAnswerKey } from "./aocp-grid-answer-key";

const NUMBERS_20 = Array.from({ length: 20 }, (_, i) => String(i + 1).padStart(2, "0")).join(" ");
const NUMBERS_21_40 = Array.from({ length: 20 }, (_, i) => String(i + 21)).join(" ");

const KEY = `CÂMARA MUNICIPAL ESTADO DE PERNAMBUCO
EDITAL DE CONCURSO PÚBLICO Nº 01/2019
Gabarito Pós-Recursos - Manhã
NÍVEL MÉDIO
ARQUIVISTA ${NUMBERS_20} BCACCDBABDDACBDCADXC
${NUMBERS_21_40} DABDCXXCDBCDBADBCCAB
Página 2 de 4
MOTORISTA ${NUMBERS_20} BCACCDBABDDACBDCADXC
${NUMBERS_21_40} DCBADACDBXBDBADCADCB
NÍVEL SUPERIOR CONTADOR
${NUMBERS_20} DACDBCADCBCDBACDBBAC ${NUMBERS_21_40} DACABCDCABDACACXBADC X = QUESTÃO ANULADA.
Página 4 de 4
`;

describe("parseAocpGridAnswerKey", () => {
  it("reads one block per position, joining the rows of the same position", () => {
    const blocks = parseAocpGridAnswerKey(KEY);

    expect(blocks).toHaveLength(3);
    expect(blocks.map((block) => block.answers.size)).toEqual([40, 40, 40]);
    expect(blocks[0]!.answers.get(1)).toBe("B");
    expect(blocks[0]!.answers.get(19)).toBe("X");
    expect(blocks[0]!.answers.get(21)).toBe("D");
    expect(blocks[1]!.answers.get(30)).toBe("X");
    expect(blocks[2]!.answers.get(40)).toBe("C");
  });

  it("accepts the last letter of a long row printed as its own token", () => {
    const numbers = Array.from({ length: 25 }, (_, i) => String(i + 1).padStart(2, "0")).join(" ");
    const blocks = parseAocpGridAnswerKey(`ESCRIVÃO - PROVA 1 ${numbers} CBDDABEBCCAEACDCDBXADDBA C`);

    expect(blocks[0]!.answers.size).toBe(25);
    expect(blocks[0]!.answers.get(25)).toBe("C");
  });

  it("does not take a plain numbered list or a text without grid as a key", () => {
    expect(looksLikeGridAnswerKey("1 A\n2 B\n3 C")).toBe(false);
    expect(looksLikeGridAnswerKey(KEY)).toBe(true);
  });
});

describe("findGridKeyBlock", () => {
  const blocks = parseAocpGridAnswerKey(KEY);

  it("matches the position by the end of the heading, ignoring level and accents", () => {
    const match = findGridKeyBlock(blocks, ["NÍVEL SUPERIOR - TARDE", "CONTADOR"], null);

    expect(match.ok).toBe(true);
    expect(match.ok && match.answers.get(1)).toBe("D");
  });

  it("reports a position that is not in the key", () => {
    expect(findGridKeyBlock(blocks, ["ENGENHEIRO"], null)).toEqual({ ok: false, reason: "O cargo do caderno não foi encontrado no gabarito." });
  });

  it("uses the exam variant (Prova N) when the heading carries it", () => {
    const numbers = Array.from({ length: 5 }, (_, i) => String(i + 1).padStart(2, "0")).join(" ");
    const variants = parseAocpGridAnswerKey(`ESCRIVÃO DE POLÍCIA - PROVA 1 ${numbers} ABCDE ESCRIVÃO DE POLÍCIA - PROVA 2 ${numbers} EDCBA`);

    const second = findGridKeyBlock(variants, ["ESCRIVÃO DE POLÍCIA"], 2);

    expect(second.ok && second.answers.get(1)).toBe("E");
  });
});
