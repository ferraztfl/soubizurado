import { describe, expect, it } from "vitest";

import { findByTaxonomyTerm, planManualTaxonomyName } from "./manual-taxonomy-entry";

describe("planManualTaxonomyName", () => {
  it("cleans the name and derives slug and normalized term", () => {
    expect(planManualTaxonomyName("topic", "  Extinção   da Punibilidade ")).toEqual({
      ok: true,
      entry: { name: "Extinção da Punibilidade", slug: "extincao-da-punibilidade", normalized: "extincao da punibilidade" },
    });
  });

  it("treats an empty value as level not informed", () => {
    expect(planManualTaxonomyName("subtopic", "   ")).toEqual({ ok: true, entry: null });
  });

  it("rejects names that are too short, too long or contain markup", () => {
    expect(planManualTaxonomyName("area", "A")).toEqual({ ok: false, error: "TOO_SHORT" });
    expect(planManualTaxonomyName("area", "x".repeat(161))).toEqual({ ok: false, error: "TOO_LONG" });
    expect(planManualTaxonomyName("topic", "<b>Crime</b>")).toEqual({ ok: false, error: "INVALID" });
    expect(planManualTaxonomyName("topic", "---")).toEqual({ ok: false, error: "INVALID" });
  });
});

describe("findByTaxonomyTerm", () => {
  const entries = [
    { name: "Brasil Colônia", aliases: [{ normalizedName: "periodo colonial" }] },
    { name: "Brasil Império", aliases: [] },
  ];

  it("matches by name ignoring accents and case, and by alias", () => {
    expect(findByTaxonomyTerm(entries, "brasil colonia")?.name).toBe("Brasil Colônia");
    expect(findByTaxonomyTerm(entries, "periodo colonial")?.name).toBe("Brasil Colônia");
    expect(findByTaxonomyTerm(entries, "brasil colonial")).toBeNull();
  });
});
