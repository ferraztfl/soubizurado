import { describe, expect, it } from "vitest";

import { clampScrollPercent, locateQuote, planAnnotation } from "./lesson-annotation";

describe("lesson annotations", () => {
  it("validates and trims highlights", () => {
    expect(planAnnotation({ quote: "  direitos   sociais ", prefix: "Os ", suffix: " do art. 6º", note: "", color: "green" })).toEqual({
      quote: "direitos sociais",
      prefix: "Os ",
      suffix: " do art. 6º",
      note: null,
      color: "green",
    });
    expect(planAnnotation({ quote: "a", prefix: "", suffix: "", note: "revisar", color: "purple" })?.color).toBe("yellow");
    expect(planAnnotation({ quote: "  ", prefix: "", suffix: "", note: "", color: "yellow" })).toBeNull();
    expect(planAnnotation({ quote: "x".repeat(1001), prefix: "", suffix: "", note: "", color: "yellow" })).toBeNull();
  });

  it("finds the right occurrence by its surroundings", () => {
    const text = "A crase ocorre antes de palavra feminina. Não há crase antes de verbo.";
    expect(locateQuote(text, { quote: "crase", prefix: "Não há ", suffix: " antes de verbo" })).toBe(text.lastIndexOf("crase"));
    expect(locateQuote(text, { quote: "crase", prefix: "A ", suffix: " ocorre" })).toBe(text.indexOf("crase"));
    expect(locateQuote(text, { quote: "trema", prefix: "", suffix: "" })).toBe(-1);
  });

  it("clamps the reading position", () => {
    expect(clampScrollPercent(-3)).toBe(0);
    expect(clampScrollPercent(42.6)).toBe(43);
    expect(clampScrollPercent(Number.NaN)).toBe(0);
    expect(clampScrollPercent(180)).toBe(100);
  });
});
