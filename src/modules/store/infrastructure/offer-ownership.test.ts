import { describe, expect, it } from "vitest";

import { planOfferOwnership } from "./offer-ownership";

const COURSE = "c-1";
const combo = { slug: "combo", grants: [{ kind: "COURSE", courseId: COURSE }, { kind: "QUESTION_BANK", courseId: null }] };
const yearly = { slug: "anual", grants: [{ kind: "ALL_COURSES", courseId: null }, { kind: "QUESTION_BANK", courseId: null }] };
const in10 = new Date("2026-12-10T00:00:00Z");
const in30 = new Date("2026-12-30T00:00:00Z");

describe("planOfferOwnership", () => {
  it("is not owned when something it grants is missing", () => {
    expect(planOfferOwnership([combo], [{ kind: "QUESTION_BANK", courseId: null, endsAt: in30 }]).size).toBe(0);
    expect(planOfferOwnership([combo], []).size).toBe(0);
  });

  it("is owned until the earliest end among the grants", () => {
    const owned = planOfferOwnership([combo], [
      { kind: "COURSE", courseId: COURSE, endsAt: null },
      { kind: "QUESTION_BANK", courseId: null, endsAt: in10 },
    ]);

    expect(owned.get("combo")).toEqual({ endsAt: in10 });
  });

  it("has no end when every grant has none", () => {
    const owned = planOfferOwnership([combo], [
      { kind: "COURSE", courseId: COURSE, endsAt: null },
      { kind: "QUESTION_BANK", courseId: null, endsAt: null },
    ]);

    expect(owned.get("combo")).toEqual({ endsAt: null });
  });

  it("counts a Premium subscriber (all courses + question bank) as owning course combos and the yearly plan", () => {
    const owned = planOfferOwnership([combo, yearly], [
      { kind: "ALL_COURSES", courseId: null, endsAt: in30 },
      { kind: "QUESTION_BANK", courseId: null, endsAt: in30 },
    ]);

    expect(owned.get("combo")).toEqual({ endsAt: in30 });
    expect(owned.get("anual")).toEqual({ endsAt: in30 });
  });

  it("does not count another course as this course", () => {
    const owned = planOfferOwnership([combo], [
      { kind: "COURSE", courseId: "other", endsAt: null },
      { kind: "QUESTION_BANK", courseId: null, endsAt: null },
    ]);

    expect(owned.size).toBe(0);
  });
});
