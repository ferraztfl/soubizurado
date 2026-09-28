/*
 * Spaced review of mistakes. A question answered wrong comes back the next
 * day; each correct review pushes it further (1 → 3 → 7 → 15 → 30 → 60
 * days); after the last step it is considered learned and leaves the queue.
 * A new mistake at any point restarts it. Questions answered right the first
 * time never enter the queue. Days are YYYY-MM-DD (São Paulo).
 */

export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 15, 30, 60] as const;

export type ReviewState = Readonly<{
  /** Index in REVIEW_INTERVAL_DAYS of the current wait. */
  step: number;
  dueOn: string;
  lapses: number;
}>;

export type ReviewUpdate =
  | Readonly<{ kind: "SCHEDULE"; state: ReviewState }>
  | Readonly<{ kind: "LEARNED" }>
  | Readonly<{ kind: "NONE" }>;

export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function nextReview(current: ReviewState | null, isCorrect: boolean, today: string): ReviewUpdate {
  if (!isCorrect) {
    return {
      kind: "SCHEDULE",
      state: { step: 0, dueOn: addDays(today, REVIEW_INTERVAL_DAYS[0]), lapses: (current?.lapses ?? 0) + 1 },
    };
  }

  if (!current) {
    return { kind: "NONE" };
  }

  // Answered right before the review was due (e.g. in the explorer): keep
  // the schedule, so an early lucky guess does not skip the spacing.
  if (current.dueOn > today) {
    return { kind: "NONE" };
  }

  const step = current.step + 1;

  if (step >= REVIEW_INTERVAL_DAYS.length) {
    return { kind: "LEARNED" };
  }

  return { kind: "SCHEDULE", state: { step, dueOn: addDays(today, REVIEW_INTERVAL_DAYS[step]!), lapses: current.lapses } };
}
