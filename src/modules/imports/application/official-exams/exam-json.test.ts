import { describe, expect, it } from "vitest";

import {
  EXAM_JSON_SCHEMA_ID,
  examJsonImageRefs,
  examJsonToQuestions,
  imageRefFileName,
  parseExamJson,
  validateExamJson,
} from "./exam-json";

const multipleChoice = {
  schema: EXAM_JSON_SCHEMA_ID,
  exam: {
    board: "Instituto AOCP",
    organization: "Universidade Federal da Bahia",
    role: "Assistente em Administração",
    year: 2016,
  },
  supportTexts: [{ id: "T1", text: "Texto de apoio.", images: [{ page: 3, box: [100, 50, 400, 500] }] }],
  questions: [
    {
      number: 1,
      type: "MULTIPLE_CHOICE",
      section: "Português",
      supportTextId: "T1",
      statement: "Assinale a alternativa correta.",
      alternatives: [
        { label: "a", text: "Primeira" },
        { label: "B", text: "", images: [{ page: 4, box: [10, 10, 90, 90] }] },
      ],
      answer: "b",
    },
    {
      number: 2,
      type: "MULTIPLE_CHOICE",
      statement: "Questão anulada.",
      alternatives: [
        { label: "A", text: "x" },
        { label: "B", text: "y" },
      ],
      answer: null,
      annulled: true,
    },
  ],
};

function parse(value: unknown) {
  const result = parseExamJson(value);

  if (!result.ok) {
    throw new Error(result.errors.join("; "));
  }

  return result.value;
}

describe("SouBizurado Exam JSON", () => {
  it("accepts a valid file and converts it to booklet questions", () => {
    const exam = parse(multipleChoice);

    expect(validateExamJson(exam)).toEqual([]);

    const [first, second] = examJsonToQuestions(exam);

    expect(first).toMatchObject({
      key: "1",
      type: "MULTIPLE_CHOICE",
      section: "Português",
      supportText: "Texto de apoio.",
      supportImages: ["json-p3-100-50-400-500.png"],
      answer: "B",
      annulled: false,
    });
    expect(first!.alternatives.map((alternative) => alternative.label)).toEqual(["A", "B"]);
    expect(first!.alternatives[1]!.images).toEqual(["json-p4-10-10-90-90.png"]);
    expect(second).toMatchObject({ answer: null, annulled: true });
    expect(examJsonImageRefs(exam).map(imageRefFileName)).toHaveLength(2);
  });

  it("rejects unknown fields and malformed boxes with readable paths", () => {
    const result = parseExamJson({
      ...multipleChoice,
      extra: true,
      supportTexts: [{ id: "T1", text: "x", images: [{ page: 1, box: [500, 0, 100, 10] }] }],
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.join(" | ")).toMatch(/box/);
  });

  it("reports content problems", () => {
    const exam = parse({
      ...multipleChoice,
      questions: [
        { ...multipleChoice.questions[0], supportTextId: "T9", answer: "E" },
        { ...multipleChoice.questions[0], number: 1 },
        { ...multipleChoice.questions[0], number: 4, alternatives: [{ label: "A", text: "só uma" }], answer: "A" },
      ],
    });

    const issues = validateExamJson(exam).join(" | ");

    expect(issues).toContain('texto de apoio "T9" não existe');
    expect(issues).toContain('gabarito "E" não corresponde');
    expect(issues).toContain("número repetido");
    expect(issues).toContain("pelo menos 2 alternativas");
    expect(issues).toContain("Faltam as questões: 2, 3");
  });

  it("reads true/false items with C/E or V/F answers and the group command", () => {
    const exam = parse({
      ...multipleChoice,
      supportTexts: [],
      questions: [
        { number: 1, type: "TRUE_FALSE", command: "Julgue o item a seguir.", statement: "A Terra é redonda.", answer: "C" },
        { number: 2, type: "TRUE_FALSE", statement: "A Lua é um planeta.", answer: "F" },
      ],
    });

    expect(validateExamJson(exam)).toEqual([]);
    expect(examJsonToQuestions(exam).map((question) => [question.statement, question.answer])).toEqual([
      ["Julgue o item a seguir.\n\nA Terra é redonda.", "V"],
      ["A Lua é um planeta.", "F"],
    ]);
  });

  it("accepts original question numbers with gaps in a partial exam", () => {
    const questions = [
      { ...multipleChoice.questions[0], number: 12 },
      { ...multipleChoice.questions[0], number: 25, supportTextId: null },
    ];
    const complete = parse({ ...multipleChoice, questions });
    const partial = parse({
      ...multipleChoice,
      exam: { ...multipleChoice.exam, partial: true, provenance: "Simulado exportado pelo administrador" },
      questions,
    });

    expect(validateExamJson(complete).join(" ")).toContain("Faltam as questões: 1, 2");
    expect(validateExamJson(partial)).toEqual([]);
    expect(examJsonToQuestions(partial).map((question) => question.key)).toEqual(["12", "25"]);
  });

  it("refuses to mix question types in one file", () => {
    const exam = parse({
      ...multipleChoice,
      questions: [multipleChoice.questions[0], { number: 2, type: "TRUE_FALSE", statement: "Item.", answer: "V" }],
    });

    expect(validateExamJson(exam).join(" ")).toContain("mistura múltipla escolha e Verdadeiro/Falso");
  });
});
