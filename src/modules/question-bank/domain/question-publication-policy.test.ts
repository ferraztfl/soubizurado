import {
  describe,
  expect,
  it,
} from "vitest";

import { QUESTION_TYPES } from "./question-type";
import {
  QUESTION_PUBLICATION_ISSUES,
  canPublishQuestion,
  validateQuestionForPublication,
} from "./question-publication-policy";

const baseClassification = {
  statement: "Qual alternativa apresenta a resposta correta?",
  sourceId: "source-id",
  sourceType: "OFFICIAL_EXAM",
  examination: { boardId: "board-id", year: 2024 },
  disciplineId: "discipline-id",
  topicId: "topic-id",
} as const;

describe("question publication policy", () => {
  it("accepts a valid multiple-choice question", () => {
    const candidate = {
      ...baseClassification,
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      correctTrueFalse: null,
      alternatives: [
        {
          content: "Alternativa A",
          isCorrect: true,
        },
        {
          content: "Alternativa B",
          isCorrect: false,
        },
      ],
    } as const;

    expect(
      validateQuestionForPublication(candidate),
    ).toEqual([]);

    expect(
      canPublishQuestion(candidate),
    ).toBe(true);
  });

  it("accepts image-only alternatives", () => {
    const candidate = {
      ...baseClassification,
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      correctTrueFalse: null,
      alternatives: [
        {
          content: "",
          isCorrect: true,
          mediaCount: 1,
        },
        {
          content: "  ",
          isCorrect: false,
          mediaCount: 2,
        },
      ],
    } as const;

    expect(
      validateQuestionForPublication(candidate),
    ).toEqual([]);
  });

  it("rejects an alternative with neither text nor image", () => {
    const candidate = {
      ...baseClassification,
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      correctTrueFalse: null,
      alternatives: [
        {
          content: "Alternativa A",
          isCorrect: true,
        },
        {
          content: "",
          isCorrect: false,
          mediaCount: 0,
        },
      ],
    } as const;

    expect(
      validateQuestionForPublication(candidate),
    ).toContain(
      QUESTION_PUBLICATION_ISSUES
        .ALTERNATIVE_CONTENT_REQUIRED,
    );
  });

  it("requires exactly one correct multiple-choice alternative", () => {
    const candidate = {
      ...baseClassification,
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      correctTrueFalse: null,
      alternatives: [
        {
          content: "Alternativa A",
          isCorrect: true,
        },
        {
          content: "Alternativa B",
          isCorrect: true,
        },
      ],
    } as const;

    expect(
      validateQuestionForPublication(candidate),
    ).toContain(
      QUESTION_PUBLICATION_ISSUES
        .MULTIPLE_CHOICE_SINGLE_CORRECT_REQUIRED,
    );
  });

  it("accepts a valid true-or-false question", () => {
    const candidate = {
      ...baseClassification,
      type: QUESTION_TYPES.TRUE_FALSE,
      correctTrueFalse: true,
      alternatives: [],
    } as const;

    expect(
      canPublishQuestion(candidate),
    ).toBe(true);
  });

  it("rejects alternatives on true-or-false questions", () => {
    const candidate = {
      ...baseClassification,
      type: QUESTION_TYPES.TRUE_FALSE,
      correctTrueFalse: false,
      alternatives: [
        {
          content: "Verdadeiro",
          isCorrect: false,
        },
      ],
    } as const;

    expect(
      validateQuestionForPublication(candidate),
    ).toContain(
      QUESTION_PUBLICATION_ISSUES
        .TRUE_FALSE_ALTERNATIVES_NOT_ALLOWED,
    );
  });

  it("requires provenance and minimum taxonomy for publication", () => {
    const candidate = {
      statement: "Questao valida",
      sourceId: null,
      sourceType: null,
      examination: null,
      disciplineId: null,
      topicId: null,
      type: QUESTION_TYPES.TRUE_FALSE,
      correctTrueFalse: true,
      alternatives: [],
    } as const;

    const issues =
      validateQuestionForPublication(candidate);

    expect(issues).toContain(
      QUESTION_PUBLICATION_ISSUES.SOURCE_REQUIRED,
    );

    expect(issues).toContain(
      QUESTION_PUBLICATION_ISSUES.DISCIPLINE_REQUIRED,
    );

    expect(issues).toContain(
      QUESTION_PUBLICATION_ISSUES.TOPIC_REQUIRED,
    );
  });
  it("requires the exam, its board and its year for exam questions", () => {
    const alternatives = [
      { content: "A", isCorrect: true },
      { content: "B", isCorrect: false },
    ];
    const base = {
      ...baseClassification,
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      correctTrueFalse: null,
      alternatives,
    };

    expect(validateQuestionForPublication({ ...base, examination: null })).toContain(
      QUESTION_PUBLICATION_ISSUES.EXAMINATION_REQUIRED,
    );
    expect(
      validateQuestionForPublication({ ...base, examination: { boardId: null, year: null } }),
    ).toEqual([
      QUESTION_PUBLICATION_ISSUES.BOARD_REQUIRED,
      QUESTION_PUBLICATION_ISSUES.YEAR_REQUIRED,
    ]);
  });

  it("does not require an exam for original questions", () => {
    expect(
      validateQuestionForPublication({
        ...baseClassification,
        sourceType: "ORIGINAL",
        examination: null,
        type: QUESTION_TYPES.MULTIPLE_CHOICE,
        correctTrueFalse: null,
        alternatives: [
          { content: "A", isCorrect: true },
          { content: "B", isCorrect: false },
        ],
      }),
    ).toEqual([]);
  });
});
