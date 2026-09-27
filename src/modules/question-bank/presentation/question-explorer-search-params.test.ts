import {
  describe,
  expect,
  it,
} from "vitest";

import {
  QUESTION_TYPES,
} from "../domain/question-type";

import {
  buildQuestionExplorerHref,
  parseQuestionExplorerSearchParams,
} from "./question-explorer-search-params";

describe("question explorer search params", () => {
  it("normalizes filters and pagination from URL params", () => {
    expect(
      parseQuestionExplorerSearchParams({
        q: "  constitucional ",
        discipline: " discipline-1 ",
        board: " board-1 ",
        year: "2026",
        type: "MULTIPLE_CHOICE",
        page: "3",
      }),
    ).toEqual({
      page: 3,
      pageSize: 10,
      sort: "recentes",
      filters: {
        search: "constitucional",
        disciplineId: "discipline-1",
        boardId: "board-1",
        year: 2026,
        type: QUESTION_TYPES.MULTIPLE_CHOICE,
      },
    });
  });

  it("reads page size and sort, falling back to the defaults", () => {
    expect(parseQuestionExplorerSearchParams({ por: "50", ordem: "ano" })).toMatchObject({ pageSize: 50, sort: "ano" });
    expect(parseQuestionExplorerSearchParams({ por: "13", ordem: "x" })).toMatchObject({ pageSize: 10, sort: "recentes" });
    expect(buildQuestionExplorerHref({ pageSize: 20, sort: "antigas", page: 2 })).toBe("/app/questoes?por=20&ordem=antigas&page=2");
    expect(buildQuestionExplorerHref({ pageSize: 10, sort: "recentes" })).toBe("/app/questoes");
  });

  it("falls back safely for malformed URL values", () => {
    expect(
      parseQuestionExplorerSearchParams({
        q: "   ",
        year: "abc",
        type: "OTHER",
        page: "-4",
      }),
    ).toEqual({
      page: 1,
      pageSize: 10,
      sort: "recentes",
      filters: {},
    });
  });

  it("uses the first value when Next search params contain arrays", () => {
    expect(
      parseQuestionExplorerSearchParams({
        page: ["2", "7"],
        year: ["2025", "2024"],
      }),
    ).toEqual({
      page: 2,
      pageSize: 10,
      sort: "recentes",
      filters: {
        year: 2025,
      },
    });
  });

  it("builds pagination links while preserving active filters", () => {
    expect(
      buildQuestionExplorerHref({
        page: 2,
        search: "direito penal",
        disciplineId: "discipline-1",
        boardId: "board-1",
        year: 2026,
        type: QUESTION_TYPES.TRUE_FALSE,
      }),
    ).toBe(
      "/app/questoes?q=direito+penal&discipline=discipline-1&board=board-1&year=2026&type=TRUE_FALSE&page=2",
    );
  });
});
