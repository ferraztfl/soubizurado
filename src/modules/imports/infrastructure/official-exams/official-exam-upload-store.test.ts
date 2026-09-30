import { describe, expect, it } from "vitest";

import { assertAnswerKey, isPdf } from "./official-exam-upload-store";

const text = (value: string) => new TextEncoder().encode(value);

describe("official exam answer key", () => {
  it("accepts the board's PDF or the text of the official results page", () => {
    expect(isPdf(text("%PDF-1.7 …"))).toBe(true);
    expect(() => assertAnswerKey(text("%PDF-1.7 conteúdo"))).not.toThrow();
    expect(() =>
      assertAnswerKey(text("Gabarito definitivo — Tipo 1\n1 X 2 A 3 E 4 B 5 D 6 C 7 C 8 A 9 C 10 E 11 B 12 A")),
    ).not.toThrow();
  });

  it("refuses empty, huge or unrelated text", () => {
    expect(() => assertAnswerKey(new Uint8Array())).toThrow(/Gabarito/);
    expect(() => assertAnswerKey(text("não é um gabarito"))).toThrow(/pares/);
    expect(() => assertAnswerKey(text("1 A ".repeat(20_000)))).toThrow(/64 KB/);
  });
});
