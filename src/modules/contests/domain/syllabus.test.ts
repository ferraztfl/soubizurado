import { describe, expect, it } from "vitest";

import { formatSyllabusText, parseSyllabusText, planSyllabus, studiedPercent, totalQuestions } from "./syllabus";

const TEXT = `# Língua Portuguesa | 10 | Bloco I
1. Compreensão e interpretação de textos.
2. Tipologias e gêneros textuais.

# História de Pernambuco | 10
1. Ocupação e colonização.
2.1 Revolução Pernambucana (1817).
a) Confederação do Equador (1824).
Aspectos afro-brasileiros em Pernambuco.
`;

describe("syllabus text", () => {
  it("parses subjects, counts, blocks and numbered topics", () => {
    const parsed = parseSyllabusText(TEXT);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.subjects.map((subject) => [subject.name, subject.questionCount, subject.block])).toEqual([
      ["Língua Portuguesa", 10, "Bloco I"],
      ["História de Pernambuco", 10, null],
    ]);
    expect(parsed.subjects[1]!.topics).toEqual([
      { code: "1", text: "Ocupação e colonização." },
      { code: "2.1", text: "Revolução Pernambucana (1817)." },
      { code: "a", text: "Confederação do Equador (1824)." },
      { code: null, text: "Aspectos afro-brasileiros em Pernambuco." },
    ]);
    expect(totalQuestions(parsed.subjects)).toBe(20);
  });

  it("round-trips through the admin text", () => {
    const parsed = parseSyllabusText(TEXT);
    if (!parsed.ok) throw new Error("parse");
    const again = parseSyllabusText(formatSyllabusText(parsed.subjects));
    expect(again).toEqual(parsed);
  });

  it("reads the optional taxonomy link", () => {
    const parsed = parseSyllabusText("# História de Pernambuco | 10 | Bloco I | História > História de Pernambuco\n1. Olinda.\n# Gestão | | | Saúde Pública");
    expect(parsed.ok && parsed.subjects.map((subject) => subject.link)).toEqual([
      { discipline: "História", target: "História de Pernambuco" },
      { discipline: "Saúde Pública", target: null },
    ]);
    if (!parsed.ok) return;
    expect(formatSyllabusText(parsed.subjects)).toContain("# Gestão | | | Saúde Pública");
    expect(parseSyllabusText(formatSyllabusText(parsed.subjects))).toEqual(parsed);
    expect(parseSyllabusText("# X | 1 | B | a > b > c")).toMatchObject({ ok: false, error: { line: 1, reason: "SUBJECT" } });
    expect(parseSyllabusText("# X | 1 | B | História > ")).toMatchObject({ ok: false, error: { line: 1, reason: "SUBJECT" } });
  });

  it("points to the line of the problem", () => {
    expect(parseSyllabusText("1. Sem matéria antes")).toEqual({ ok: false, error: { line: 1, reason: "TOPIC_OUTSIDE_SUBJECT" } });
    expect(parseSyllabusText("# Português\n\n# X | dez")).toEqual({ ok: false, error: { line: 3, reason: "SUBJECT" } });
    expect(parseSyllabusText(`# Português\n1. ${"a".repeat(601)}`)).toEqual({ ok: false, error: { line: 2, reason: "TOPIC" } });
  });

  it("plans a position's syllabus", () => {
    const base = { title: " Soldado  (Praça QPMG) ", slug: "", essayPoints: "40", durationMinutes: "", notes: "", text: TEXT, isPublished: true };
    const result = planSyllabus(base);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.syllabus.title).toBe("Soldado (Praça QPMG)");
      expect(result.syllabus.slug).toBe("soldado-praca-qpmg");
      expect(result.syllabus.essayPoints).toBe(40);
      expect(result.syllabus.durationMinutes).toBeNull();
    }
    expect(planSyllabus({ ...base, essayPoints: "-1" })).toEqual({ ok: false, error: "ESSAY_INVALID" });
    expect(planSyllabus({ ...base, text: "  " })).toEqual({ ok: false, error: "TEXT_EMPTY" });
    expect(planSyllabus({ ...base, text: "solto" })).toMatchObject({ ok: false, error: "TEXT_INVALID", detail: { line: 1 } });
  });

  it("measures the checklist", () => {
    expect(studiedPercent(0, 0)).toBe(0);
    expect(studiedPercent(1, 3)).toBe(33);
    expect(studiedPercent(5, 3)).toBe(100);
  });
});
