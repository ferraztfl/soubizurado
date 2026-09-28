import { describe, expect, it } from "vitest";

import { buildMissions, type MissionProgressInput } from "./missions";

const base: MissionProgressInput = {
  dailyGoal: 20,
  today: { attempts: 0, correct: 0 },
  dueReviews: 3,
  week: { attempts: 0, correct: 0, activeDays: 0, finishedSessions: 0, finishedSimulations: 0 },
};

const byId = (input: MissionProgressInput) => new Map(buildMissions(input).map((mission) => [mission.id, mission]));

describe("buildMissions", () => {
  it("tracks the daily goal and the correct answers (60% of the goal)", () => {
    const missions = byId({ ...base, today: { attempts: 25, correct: 11 } });

    expect(missions.get("daily-goal")).toMatchObject({ current: 20, target: 20, done: true });
    expect(missions.get("daily-correct")).toMatchObject({ current: 11, target: 12, done: false });
  });

  it("reviews are done only when nothing is due", () => {
    expect(byId(base).get("daily-reviews")?.done).toBe(false);
    expect(byId({ ...base, dueReviews: 0 }).get("daily-reviews")?.done).toBe(true);
  });

  it("weekly accuracy needs enough answers", () => {
    const few = byId({ ...base, week: { ...base.week, attempts: 10, correct: 10 } });
    const enough = byId({ ...base, week: { ...base.week, attempts: 40, correct: 30 } });

    expect(few.get("weekly-accuracy")?.done).toBe(false);
    expect(enough.get("weekly-accuracy")).toMatchObject({ current: 70, done: true });
  });

  it("weekly counters", () => {
    const missions = byId({ ...base, week: { ...base.week, activeDays: 5, finishedSessions: 2, finishedSimulations: 1 } });

    expect(missions.get("weekly-days")?.done).toBe(true);
    expect(missions.get("weekly-sessions")).toMatchObject({ current: 2, done: false });
    expect(missions.get("weekly-simulation")?.done).toBe(true);
  });
});
