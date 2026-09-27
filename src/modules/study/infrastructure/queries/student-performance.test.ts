import { describe, expect, it } from "vitest";

import { buildWeeks, countStreak, PERFORMANCE_WEEKS, weakestTopics } from "./student-performance";

describe("student performance helpers", () => {
  it("counts consecutive study days ending today or yesterday", () => {
    const days = new Set(["2026-09-25", "2026-09-26", "2026-09-27"]);

    expect(countStreak(days, "2026-09-27")).toBe(3);
    expect(countStreak(days, "2026-09-28")).toBe(3);
    expect(countStreak(days, "2026-09-29")).toBe(0);
  });

  it("fills the last weeks, oldest first, ending in the current week (Monday start)", () => {
    const weeks = buildWeeks([{ weekStart: "2026-09-21", attempts: 5, correct: 3 }], "2026-09-27");

    expect(weeks).toHaveLength(PERFORMANCE_WEEKS);
    expect(weeks.at(-1)).toEqual({ weekStart: "2026-09-21", attempts: 5, correct: 3 });
    expect(weeks.at(-2)).toEqual({ weekStart: "2026-09-14", attempts: 0, correct: 0 });
  });

  it("lists weak topics with enough answers, lowest hit rate first", () => {
    const topic = (name: string, attempts: number, correct: number) => ({
      areaId: name,
      name,
      disciplineId: "d",
      disciplineName: "D",
      attempts,
      correct,
    });

    expect(
      weakestTopics([topic("ok", 4, 4), topic("few", 2, 0), topic("bad", 5, 1), topic("mid", 4, 2)]).map(
        (item) => item.name,
      ),
    ).toEqual(["bad", "mid"]);
  });
});
