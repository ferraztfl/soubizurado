import { describe, expect, it } from "vitest";

import { buildDays, buildWeeks, countStreak, PERFORMANCE_WEEKS, weakestTopics } from "./student-performance";

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

describe("buildDays", () => {
  it("returns the last 7 days ending today, oldest first, with zeros for quiet days", () => {
    const days = buildDays([{ day: "2026-10-01", attempts: 8, correct: 5 }, { day: "2026-09-28", attempts: 2, correct: 2 }], "2026-10-01");

    expect(days.map((day) => day.day)).toEqual(["2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"]);
    expect(days[3]).toEqual({ day: "2026-09-28", attempts: 2, correct: 2 });
    expect(days[4]).toEqual({ day: "2026-09-29", attempts: 0, correct: 0 });
    expect(days[6]).toEqual({ day: "2026-10-01", attempts: 8, correct: 5 });
  });
});
