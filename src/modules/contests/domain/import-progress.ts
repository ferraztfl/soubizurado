/*
 * Progress of a notice import, shown as a percentage. The AI "reading"
 * phase gives no progress events, so it is estimated from the elapsed time
 * and the measured speed of this machine; the "writing" phase is measured
 * token by token (streaming).
 */

export type ImportPhase = "received" | "pdf" | "excerpts" | "reading" | "writing" | "checking" | "done" | "error";

export const PHASE_LABELS: Readonly<Record<ImportPhase, string>> = {
  received: "PDF recebido",
  pdf: "Extraindo o texto do PDF",
  excerpts: "Selecionando os trechos importantes",
  reading: "A IA está lendo o edital",
  writing: "A IA está escrevendo a resposta",
  checking: "Conferindo os dados e montando o formulário",
  done: "Pronto",
  error: "Não foi possível concluir",
};

/** Typical answer size of the facts JSON (tokens), used to scale the writing phase. */
export const EXPECTED_OUTPUT_TOKENS = 340;

/** Portuguese text is ~3.1 characters per token for these models. */
export function estimatePromptTokens(characters: number): number {
  return Math.ceil(characters / 3.1) + 450; // + instructions and schema
}

export type ProgressSnapshot = Readonly<{
  phase: ImportPhase;
  /** When the current phase started (ms). */
  phaseStartedAt: number;
  /** Estimated duration of the reading phase (ms). */
  expectedReadingMs: number;
  generatedTokens: number;
  /** Tokens per second the machine writes at (for the remaining time). */
  writingTokensPerSecond: number;
}>;

/** 0–100 for the current moment (never 100 before the end). */
export function progressPercent(snapshot: ProgressSnapshot, now: number): number {
  switch (snapshot.phase) {
    case "received":
      return 5;
    case "pdf":
      return 10;
    case "excerpts":
      return 18;
    case "reading": {
      const ratio = snapshot.expectedReadingMs > 0 ? (now - snapshot.phaseStartedAt) / snapshot.expectedReadingMs : 0;
      // Linear up to the estimate, then creeping (the estimate can be short).
      const eased = ratio <= 1 ? ratio * 0.92 : 0.92 + 0.07 * (1 - 1 / (1 + (ratio - 1) * 2));
      return Math.round(20 + 50 * Math.min(eased, 0.99));
    }
    case "writing":
      return Math.round(70 + 25 * Math.min(snapshot.generatedTokens / EXPECTED_OUTPUT_TOKENS, 0.98));
    case "checking":
      return 97;
    case "done":
      return 100;
    case "error":
      return 0;
  }
}

/** Seconds left, or null when it cannot be told. */
export function remainingSeconds(snapshot: ProgressSnapshot, now: number): number | null {
  const writingSeconds = EXPECTED_OUTPUT_TOKENS / Math.max(snapshot.writingTokensPerSecond, 0.5);
  if (snapshot.phase === "reading") {
    const readingLeft = Math.max(snapshot.expectedReadingMs - (now - snapshot.phaseStartedAt), 0) / 1000;
    return Math.round(readingLeft + writingSeconds + 3);
  }
  if (snapshot.phase === "writing") {
    const left = Math.max(EXPECTED_OUTPUT_TOKENS - snapshot.generatedTokens, 0) / Math.max(snapshot.writingTokensPerSecond, 0.5);
    return Math.round(left + 3);
  }
  if (snapshot.phase === "received" || snapshot.phase === "pdf" || snapshot.phase === "excerpts") {
    return Math.round(snapshot.expectedReadingMs / 1000 + writingSeconds + 5);
  }
  return snapshot.phase === "checking" ? 2 : null;
}

/** "3 min 20 s" / "45 s". */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  return minutes > 0 ? `${minutes} min ${String(total % 60).padStart(2, "0")} s` : `${total} s`;
}
