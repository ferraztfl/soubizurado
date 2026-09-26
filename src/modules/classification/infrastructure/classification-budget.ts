type Environment = Readonly<Record<string, string | undefined>>;

/*
 * Spending guard for background classification runs. Prices are the
 * provider's list prices in USD per million tokens (check the provider
 * pricing page; they change). Without prices the estimate is unknown
 * and only the call cap protects the balance.
 *
 *   CLASSIFIER_PRICE_INPUT_USD_PER_M=0.10
 *   CLASSIFIER_PRICE_OUTPUT_USD_PER_M=0.40
 *   CLASSIFIER_RUN_BUDGET_USD=1        (stop a run at this estimated cost)
 *   CLASSIFIER_MAX_AI_CALLS_PER_RUN=500
 */

export type ClassificationBudget = Readonly<{
  inputPricePerMillion: number | null;
  outputPricePerMillion: number | null;
  runBudgetUsd: number | null;
  maxAiCallsPerRun: number;
}>;

function optionalNonNegative(name: string, value: string | undefined): number | null {
  if (!value?.trim()) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }

  return parsed;
}

export function readClassificationBudget(env: Environment = process.env): ClassificationBudget {
  const maxAiCallsPerRun = Number(env.CLASSIFIER_MAX_AI_CALLS_PER_RUN ?? "500");

  if (!Number.isSafeInteger(maxAiCallsPerRun) || maxAiCallsPerRun < 1) {
    throw new Error("CLASSIFIER_MAX_AI_CALLS_PER_RUN must be a positive integer.");
  }

  return {
    inputPricePerMillion: optionalNonNegative("CLASSIFIER_PRICE_INPUT_USD_PER_M", env.CLASSIFIER_PRICE_INPUT_USD_PER_M),
    outputPricePerMillion: optionalNonNegative("CLASSIFIER_PRICE_OUTPUT_USD_PER_M", env.CLASSIFIER_PRICE_OUTPUT_USD_PER_M),
    runBudgetUsd: optionalNonNegative("CLASSIFIER_RUN_BUDGET_USD", env.CLASSIFIER_RUN_BUDGET_USD),
    maxAiCallsPerRun,
  };
}

/** Estimated USD cost, or null when prices are not configured. */
export function estimateCostUsd(
  budget: ClassificationBudget,
  tokens: Readonly<{ inputTokens: number; outputTokens: number }>,
): number | null {
  if (budget.inputPricePerMillion === null || budget.outputPricePerMillion === null) {
    return null;
  }

  return (
    (tokens.inputTokens * budget.inputPricePerMillion + tokens.outputTokens * budget.outputPricePerMillion) /
    1_000_000
  );
}

/** Why a run must stop now, or null to continue. */
export function budgetStopReason(
  budget: ClassificationBudget,
  spent: Readonly<{ remoteAiCalls: number; inputTokens: number; outputTokens: number }>,
): string | null {
  if (spent.remoteAiCalls >= budget.maxAiCallsPerRun) {
    return `Limite de ${budget.maxAiCallsPerRun} chamadas à IA por execução atingido.`;
  }

  const cost = estimateCostUsd(budget, spent);

  if (cost !== null && budget.runBudgetUsd !== null && cost >= budget.runBudgetUsd) {
    return `Teto de gasto da execução atingido (≈ US$ ${cost.toFixed(2)} de US$ ${budget.runBudgetUsd.toFixed(2)}).`;
  }

  return null;
}
