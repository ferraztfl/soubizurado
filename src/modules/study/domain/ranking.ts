/*
 * Student ranking. Points = distinct questions answered right in the period
 * (answering the same question again does not add points); ties go to the
 * better accuracy. Periods follow São Paulo time.
 */

export const RANKING_PERIODS = {
  semana: "Esta semana",
  mes: "Este mês",
} as const;

export type RankingPeriod = keyof typeof RANKING_PERIODS;

export const RANKING_SIZE = 50;

export function parseRankingPeriod(value: string | undefined): RankingPeriod {
  return value === "mes" ? "mes" : "semana";
}

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** First day (YYYY-MM-DD) of the period that contains `today`: Monday, or the 1st. */
export function periodStartDay(period: RankingPeriod, today: string): string {
  if (period === "mes") return `${today.slice(0, 7)}-01`;

  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  return addDays(today, -((weekday + 6) % 7));
}

export type RankingEntry = Readonly<{
  position: number;
  profileId: string;
  name: string;
  points: number;
  answered: number;
  accuracy: number;
}>;

export function accuracyOf(points: number, answered: number): number {
  return answered === 0 ? 0 : Math.round((points / answered) * 100);
}
