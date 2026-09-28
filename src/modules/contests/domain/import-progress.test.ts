import { describe, expect, it } from "vitest";

import {
  estimatePromptTokens,
  EXPECTED_OUTPUT_TOKENS,
  formatDuration,
  progressPercent,
  remainingSeconds,
  type ProgressSnapshot,
} from "./import-progress";

const base: ProgressSnapshot = {
  phase: "reading",
  phaseStartedAt: 0,
  expectedReadingMs: 200_000,
  generatedTokens: 0,
  writingTokensPerSecond: 8,
};

describe("import progress", () => {
  it("grows during reading and never reaches the writing range early", () => {
    expect(progressPercent(base, 0)).toBe(20);
    expect(progressPercent(base, 100_000)).toBe(43);
    expect(progressPercent(base, 200_000)).toBe(66);
    expect(progressPercent(base, 2_000_000)).toBeLessThan(70);
  });

  it("measures the writing phase by tokens", () => {
    expect(progressPercent({ ...base, phase: "writing", generatedTokens: 0 }, 0)).toBe(70);
    const half = EXPECTED_OUTPUT_TOKENS / 2;
    expect(progressPercent({ ...base, phase: "writing", generatedTokens: half }, 0)).toBe(Math.round(70 + 25 * 0.5));
    expect(progressPercent({ ...base, phase: "writing", generatedTokens: 5_000 }, 0)).toBe(95);
    expect(progressPercent({ ...base, phase: "done" }, 0)).toBe(100);
  });

  it("estimates what is left", () => {
    expect(remainingSeconds(base, 100_000)).toBe(Math.round(100 + EXPECTED_OUTPUT_TOKENS / 8 + 3));
    expect(remainingSeconds({ ...base, phase: "writing", generatedTokens: EXPECTED_OUTPUT_TOKENS - 40 }, 0)).toBe(8);
    expect(remainingSeconds({ ...base, phase: "writing", generatedTokens: EXPECTED_OUTPUT_TOKENS * 2 }, 0)).toBe(3);
    expect(remainingSeconds({ ...base, phase: "done" }, 0)).toBeNull();
  });

  it("formats and estimates", () => {
    expect(formatDuration(200)).toBe("3 min 20 s");
    expect(formatDuration(45)).toBe("45 s");
    expect(estimatePromptTokens(18_000)).toBe(6257);
  });
});
