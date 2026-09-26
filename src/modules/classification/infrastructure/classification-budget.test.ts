import { describe, expect, it } from "vitest";

import { budgetStopReason, estimateCostUsd, readClassificationBudget } from "./classification-budget";

describe("classification budget", () => {
  it("defaults to a call cap without prices", () => {
    const budget = readClassificationBudget({});

    expect(budget).toEqual({
      inputPricePerMillion: null,
      outputPricePerMillion: null,
      runBudgetUsd: null,
      maxAiCallsPerRun: 500,
    });
    expect(estimateCostUsd(budget, { inputTokens: 1_000_000, outputTokens: 0 })).toBeNull();
    expect(budgetStopReason(budget, { remoteAiCalls: 499, inputTokens: 9e9, outputTokens: 0 })).toBeNull();
    expect(budgetStopReason(budget, { remoteAiCalls: 500, inputTokens: 0, outputTokens: 0 })).toContain("500");
  });

  it("estimates cost and stops at the run budget", () => {
    const budget = readClassificationBudget({
      CLASSIFIER_PRICE_INPUT_USD_PER_M: "0.10",
      CLASSIFIER_PRICE_OUTPUT_USD_PER_M: "0.40",
      CLASSIFIER_RUN_BUDGET_USD: "1",
      CLASSIFIER_MAX_AI_CALLS_PER_RUN: "10000",
    });

    expect(estimateCostUsd(budget, { inputTokens: 3_000_000, outputTokens: 500_000 })).toBeCloseTo(0.5);
    expect(budgetStopReason(budget, { remoteAiCalls: 1, inputTokens: 3_000_000, outputTokens: 500_000 })).toBeNull();
    expect(budgetStopReason(budget, { remoteAiCalls: 1, inputTokens: 8_000_000, outputTokens: 500_000 })).toContain(
      "Teto",
    );
  });

  it("rejects invalid settings", () => {
    expect(() => readClassificationBudget({ CLASSIFIER_MAX_AI_CALLS_PER_RUN: "0" })).toThrow();
    expect(() => readClassificationBudget({ CLASSIFIER_RUN_BUDGET_USD: "-1" })).toThrow();
  });
});
