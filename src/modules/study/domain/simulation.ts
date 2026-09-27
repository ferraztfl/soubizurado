/*
 * Rules of a practice exam ("simulado"): sizes, time limits, drawing the
 * questions and the clock. Pure functions; persistence lives elsewhere.
 */

export const SIMULATION_QUESTION_COUNTS = [10, 20, 30, 45, 90] as const;
export type SimulationQuestionCount = (typeof SIMULATION_QUESTION_COUNTS)[number];

/** Minutes; null = no time limit. */
export const SIMULATION_TIME_LIMITS = [null, 30, 60, 90, 120, 180, 270] as const;
export type SimulationTimeLimit = (typeof SIMULATION_TIME_LIMITS)[number];

export const SIMULATION_STATUSES = ["IN_PROGRESS", "FINISHED"] as const;
export type SimulationStatus = (typeof SIMULATION_STATUSES)[number];

/** Grace period after the limit, so a last click in flight is still saved. */
const GRACE_SECONDS = 5;

/**
 * Picks `count` distinct ids uniformly at random (Fisher–Yates on a copy).
 * `random` is injectable for tests.
 */
export function drawQuestionIds(
  ids: readonly string[],
  count: number,
  random: () => number = Math.random,
): string[] {
  const pool = [...new Set(ids)];

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [pool[index], pool[swap]] = [pool[swap]!, pool[index]!];
  }

  return pool.slice(0, Math.max(0, count));
}

/** Seconds left, or null without a time limit (never negative). */
export function remainingSeconds(
  startedAt: Date,
  timeLimitMinutes: number | null,
  now: Date = new Date(),
): number | null {
  if (timeLimitMinutes === null) {
    return null;
  }

  const end = startedAt.getTime() + timeLimitMinutes * 60_000;

  return Math.max(0, Math.floor((end - now.getTime()) / 1000));
}

/** True once the time limit (plus a short grace) has passed. */
export function isSimulationExpired(
  startedAt: Date,
  timeLimitMinutes: number | null,
  now: Date = new Date(),
): boolean {
  if (timeLimitMinutes === null) {
    return false;
  }

  return now.getTime() > startedAt.getTime() + timeLimitMinutes * 60_000 + GRACE_SECONDS * 1000;
}

/** "1h 05min" / "12min" / "45s". */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}min`;
  }

  if (minutes > 0) {
    return `${minutes}min`;
  }

  return `${seconds}s`;
}

/** Countdown clock: "29:41" or "1:05:09". */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, "0");

  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}
