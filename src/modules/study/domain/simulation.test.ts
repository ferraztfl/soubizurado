import { describe, expect, it } from "vitest";

import { drawQuestionIds, formatClock, formatDuration, isSimulationExpired, remainingSeconds } from "./simulation";

describe("simulation rules", () => {
  it("draws distinct ids, never more than available", () => {
    const ids = ["a", "b", "c", "d", "a"];
    const drawn = drawQuestionIds(ids, 3, () => 0.5);

    expect(drawn).toHaveLength(3);
    expect(new Set(drawn).size).toBe(3);
    expect(drawQuestionIds(ids, 10)).toHaveLength(4);
  });

  it("counts down the time limit and expires after a short grace", () => {
    const start = new Date("2026-09-27T10:00:00Z");

    expect(remainingSeconds(start, 30, new Date("2026-09-27T10:10:00Z"))).toBe(20 * 60);
    expect(remainingSeconds(start, 30, new Date("2026-09-27T11:00:00Z"))).toBe(0);
    expect(remainingSeconds(start, null)).toBeNull();
    expect(isSimulationExpired(start, 30, new Date("2026-09-27T10:30:03Z"))).toBe(false);
    expect(isSimulationExpired(start, 30, new Date("2026-09-27T10:30:06Z"))).toBe(true);
    expect(isSimulationExpired(start, null)).toBe(false);
  });

  it("formats durations", () => {
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(12 * 60 + 5)).toBe("12min");
    expect(formatDuration(3900)).toBe("1h 05min");
  });
});

describe("formatClock", () => {
  it("shows minutes and seconds, with hours when needed", () => {
    expect(formatClock(29 * 60 + 41)).toBe("29:41");
    expect(formatClock(5)).toBe("0:05");
    expect(formatClock(3909)).toBe("1:05:09");
  });
});
