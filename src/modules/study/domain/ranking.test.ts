import { describe, expect, it } from "vitest";

import { accuracyOf, parseRankingPeriod, periodStartDay } from "./ranking";

describe("ranking periods", () => {
  it("weeks start on Monday and months on the 1st", () => {
    expect(periodStartDay("semana", "2026-09-28")).toBe("2026-09-28"); // Monday
    expect(periodStartDay("semana", "2026-10-04")).toBe("2026-09-28"); // Sunday
    expect(periodStartDay("mes", "2026-09-28")).toBe("2026-09-01");
  });

  it("defaults to the week", () => {
    expect(parseRankingPeriod(undefined)).toBe("semana");
    expect(parseRankingPeriod("mes")).toBe("mes");
    expect(parseRankingPeriod("x")).toBe("semana");
  });

  it("accuracy", () => {
    expect(accuracyOf(7, 10)).toBe(70);
    expect(accuracyOf(0, 0)).toBe(0);
  });
});
