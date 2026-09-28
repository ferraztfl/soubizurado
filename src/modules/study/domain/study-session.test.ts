import { describe, expect, it } from "vitest";

import { firstPending, splitSession } from "./study-session";

describe("splitSession", () => {
  it("takes only due reviews, only new questions, or half and half", () => {
    expect(splitSession("REVIEW", 20, 7)).toEqual({ reviews: 7, fresh: 0 });
    expect(splitSession("NEW", 20, 7)).toEqual({ reviews: 0, fresh: 20 });
    expect(splitSession("MIXED", 20, 30)).toEqual({ reviews: 10, fresh: 10 });
    expect(splitSession("MIXED", 20, 3)).toEqual({ reviews: 3, fresh: 17 });
  });
});

describe("firstPending", () => {
  it("finds where to resume", () => {
    expect(firstPending(["correct", "wrong", "pending", "pending"])).toBe(2);
    expect(firstPending(["correct", "wrong"])).toBeNull();
  });
});
