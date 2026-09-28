import { describe, expect, it } from "vitest";

import { addDays, nextReview } from "./spaced-review";

const today = "2026-09-28";

describe("nextReview", () => {
  it("a mistake comes back tomorrow and counts a lapse", () => {
    expect(nextReview(null, false, today)).toEqual({ kind: "SCHEDULE", state: { step: 0, dueOn: "2026-09-29", lapses: 1 } });
    expect(nextReview({ step: 3, dueOn: today, lapses: 1 }, false, today)).toEqual({
      kind: "SCHEDULE",
      state: { step: 0, dueOn: "2026-09-29", lapses: 2 },
    });
  });

  it("a right first answer does not enter the queue", () => {
    expect(nextReview(null, true, today)).toEqual({ kind: "NONE" });
  });

  it("each due review done right pushes it further, then it is learned", () => {
    expect(nextReview({ step: 0, dueOn: today, lapses: 1 }, true, today)).toEqual({
      kind: "SCHEDULE",
      state: { step: 1, dueOn: "2026-10-01", lapses: 1 },
    });
    expect(nextReview({ step: 4, dueOn: "2026-09-01", lapses: 1 }, true, today)).toEqual({
      kind: "SCHEDULE",
      state: { step: 5, dueOn: "2026-11-27", lapses: 1 },
    });
    expect(nextReview({ step: 5, dueOn: today, lapses: 1 }, true, today)).toEqual({ kind: "LEARNED" });
  });

  it("a right answer before the review is due keeps the schedule", () => {
    expect(nextReview({ step: 2, dueOn: "2026-10-05", lapses: 1 }, true, today)).toEqual({ kind: "NONE" });
  });
});

describe("addDays", () => {
  it("crosses months and years", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
