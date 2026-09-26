import { describe, expect, it } from "vitest";

import {
  buildReviewQueueHref,
  parseReviewQueueSearchParams,
} from "./review-queue-search-params";

const disciplineId = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("parseReviewQueueSearchParams", () => {
  it("defaults to unclassified questions on the first page", () => {
    expect(parseReviewQueueSearchParams({})).toEqual({
      page: 1,
      pageSize: 25,
      topic: "missing",
      media: "all",
      suggestion: "all",
    });
  });

  it("normalizes valid filters", () => {
    expect(
      parseReviewQueueSearchParams({
        q: "  reta de tendência ",
        discipline: disciplineId.toUpperCase(),
        topic: "assigned",
        media: "with",
        suggestion: "with",
        page: "3",
      }),
    ).toEqual({
      page: 3,
      pageSize: 25,
      search: "reta de tendência",
      disciplineId,
      topic: "assigned",
      media: "with",
      suggestion: "with",
    });
  });

  it("ignores malformed values instead of failing", () => {
    expect(
      parseReviewQueueSearchParams({
        discipline: "not-a-uuid",
        topic: "everything",
        media: "sometimes",
        suggestion: "maybe",
        page: "-2",
      }),
    ).toEqual({
      page: 1,
      pageSize: 25,
      topic: "missing",
      media: "all",
      suggestion: "all",
    });
  });

  it("uses the first value of repeated params and caps search length", () => {
    const query = parseReviewQueueSearchParams({
      q: ["a".repeat(500), "ignored"],
    });

    expect(query.search).toHaveLength(200);
  });
});

describe("buildReviewQueueHref", () => {
  it("omits default values", () => {
    expect(
      buildReviewQueueHref({ topic: "missing", media: "all", page: 1 }),
    ).toBe("/admin/questoes/revisao");
  });

  it("preserves active filters across pages", () => {
    expect(
      buildReviewQueueHref({
        search: "função",
        disciplineId,
        topic: "all",
        media: "without",
        suggestion: "with",
        page: 2,
      }),
    ).toBe(
      `/admin/questoes/revisao?q=fun%C3%A7%C3%A3o&discipline=${disciplineId}&topic=all&media=without&suggestion=with&page=2`,
    );
  });
});
