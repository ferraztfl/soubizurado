import { describe, expect, it } from "vitest";

import { daysUntil, planStudyGoals, type GoalsInput } from "./study-preferences";

const base: GoalsInput = {
  dailyGoal: "30",
  targetExam: "  PM  PR — Soldado ",
  targetBoardId: "b1",
  targetExamDate: "2027-03-14",
  today: "2026-09-28",
};

describe("planStudyGoals", () => {
  it("normalizes the goals", () => {
    expect(planStudyGoals(base)).toEqual({
      ok: true,
      goals: { dailyGoal: 30, targetExam: "PM PR — Soldado", targetBoardId: "b1", targetExamDate: "2027-03-14" },
    });
    expect(planStudyGoals({ ...base, targetExam: " ", targetExamDate: "" })).toMatchObject({
      ok: true,
      goals: { targetExam: null, targetExamDate: null },
    });
  });

  it("rejects an invalid goal or exam date", () => {
    expect(planStudyGoals({ ...base, dailyGoal: "0" })).toEqual({ ok: false, error: "DAILY_GOAL_INVALID" });
    expect(planStudyGoals({ ...base, dailyGoal: "abc" })).toEqual({ ok: false, error: "DAILY_GOAL_INVALID" });
    expect(planStudyGoals({ ...base, targetExamDate: "2026-09-27" })).toEqual({ ok: false, error: "EXAM_DATE_INVALID" });
    expect(planStudyGoals({ ...base, targetExamDate: "2040-01-01" })).toEqual({ ok: false, error: "EXAM_DATE_INVALID" });
    expect(planStudyGoals({ ...base, targetExam: "x".repeat(181) })).toEqual({ ok: false, error: "TARGET_EXAM_TOO_LONG" });
  });
});

describe("daysUntil", () => {
  it("counts whole days", () => {
    expect(daysUntil("2026-09-28", "2026-09-28")).toBe(0);
    expect(daysUntil("2026-10-28", "2026-09-28")).toBe(30);
  });
});
