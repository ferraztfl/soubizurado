import { describe, expect, it } from "vitest";

import { buildSections, formatExamDuration, planBlueprint, sectionOf } from "./official-simulation";

describe("planBlueprint", () => {
  it("is complete when every subject can give all its questions", () => {
    const plan = planBlueprint([
      { id: "a", name: "Português", questionCount: 10, available: 500 },
      { id: "b", name: "Informática", questionCount: 5, available: 5 },
    ]);

    expect(plan.complete).toBe(true);
    expect(plan.totalWanted).toBe(15);
    expect(plan.totalAvailable).toBe(15);
  });

  it("reports the shortage of a subject without enough questions", () => {
    const plan = planBlueprint([
      { id: "a", name: "Português", questionCount: 10, available: 500 },
      { id: "b", name: "Clínica Médica", questionCount: 30, available: 12 },
    ]);

    expect(plan.complete).toBe(false);
    expect(plan.totalAvailable).toBe(22);
    expect(plan.subjects[1]!.shortage).toBe(18);
  });

  it("ignores subjects the notice gives no question count to (optional language)", () => {
    const plan = planBlueprint([
      { id: "a", name: "Português", questionCount: 10, available: 50 },
      { id: "b", name: "Língua Inglesa", questionCount: 0, available: 80 },
    ]);

    expect(plan.subjects).toHaveLength(1);
    expect(plan.totalWanted).toBe(10);
  });
});

describe("sections", () => {
  const sections = buildSections([
    { subjectId: "a", name: "Português", wanted: 3, ids: ["1", "2", "3"] },
    { subjectId: "b", name: "Vazia", wanted: 2, ids: [] },
    { subjectId: "c", name: "Informática", wanted: 2, ids: ["4", "5"] },
  ]);

  it("lays the subjects out in order, skipping the empty ones", () => {
    expect(sections).toEqual([
      { subjectId: "a", name: "Português", from: 0, to: 2, wanted: 3, drawn: 3 },
      { subjectId: "c", name: "Informática", from: 3, to: 4, wanted: 2, drawn: 2 },
    ]);
  });

  it("finds the section of a position", () => {
    expect(sectionOf(sections, 1)?.name).toBe("Português");
    expect(sectionOf(sections, 4)?.name).toBe("Informática");
    expect(sectionOf(sections, 9)).toBeNull();
  });
});

describe("formatExamDuration", () => {
  it("writes the notice duration", () => {
    expect(formatExamDuration(300)).toBe("5h00");
    expect(formatExamDuration(270)).toBe("4h30");
    expect(formatExamDuration(45)).toBe("45min");
  });
});
