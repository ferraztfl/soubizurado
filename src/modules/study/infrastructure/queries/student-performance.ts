import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

/*
 * Read-only performance summary of one student, aggregated in SQL from
 * study_answer_attempts. Days and weeks follow Brazil's official time
 * (America/Sao_Paulo). Every attempt counts (a question answered twice
 * counts twice), like the answer statistics shown after answering.
 */

const TIME_ZONE = "America/Sao_Paulo";
export const PERFORMANCE_WEEKS = 12;
/** A topic needs this many answers before it can be called a weak spot. */
export const WEAK_TOPIC_MIN_ATTEMPTS = 3;

export type PerformanceCounts = Readonly<{
  attempts: number;
  correct: number;
}>;

export type DisciplinePerformance = PerformanceCounts &
  Readonly<{ disciplineId: string; name: string }>;

export type TopicPerformance = PerformanceCounts &
  Readonly<{ areaId: string; name: string; disciplineId: string; disciplineName: string }>;

export type WeekPerformance = PerformanceCounts &
  Readonly<{ /** Monday of the week, YYYY-MM-DD. */ weekStart: string }>;

export type StudentPerformance = Readonly<{
  totals: PerformanceCounts &
    Readonly<{
      distinctQuestions: number;
      thisWeek: number;
      today: number;
      /** Distinct questions with at least one wrong answer. */
      wrongQuestions: number;
      averageResponseSeconds: number | null;
      /** Consecutive days with answers, ending today or yesterday. */
      streakDays: number;
    }>;
  weeks: readonly WeekPerformance[];
  disciplines: readonly DisciplinePerformance[];
  topics: readonly TopicPerformance[];
  /** Discipline of the latest answer, to "continue studying". */
  lastActivity: Readonly<{ disciplineId: string; disciplineName: string; answeredAt: Date }> | null;
}>;

type Row = Record<string, unknown>;

const toNumber = (value: unknown) => Number(value ?? 0);

/** YYYY-MM-DD of a date in São Paulo. */
function localDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(date);
}

function shiftDay(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Monday (YYYY-MM-DD) of the week that contains `day`. */
function mondayOf(day: string): string {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return shiftDay(day, -((weekday + 6) % 7));
}

export function countStreak(activeDays: ReadonlySet<string>, today: string): number {
  let cursor = activeDays.has(today) ? today : shiftDay(today, -1);
  let streak = 0;

  while (activeDays.has(cursor)) {
    streak += 1;
    cursor = shiftDay(cursor, -1);
  }

  return streak;
}

export function buildWeeks(rows: readonly WeekPerformance[], today: string): WeekPerformance[] {
  const byWeek = new Map(rows.map((row) => [row.weekStart, row]));
  const currentMonday = mondayOf(today);

  return Array.from({ length: PERFORMANCE_WEEKS }, (_, index) => {
    const weekStart = shiftDay(currentMonday, -7 * (PERFORMANCE_WEEKS - 1 - index));
    return byWeek.get(weekStart) ?? { weekStart, attempts: 0, correct: 0 };
  });
}

export async function loadStudentPerformance(profileId: string, now = new Date()): Promise<StudentPerformance> {
  const prisma = getPrismaClient();
  const today = localDay(now);
  const firstWeek = shiftDay(mondayOf(today), -7 * (PERFORMANCE_WEEKS - 1));

  const [totalsRows, dayRows, weekRows, disciplineRows, topicRows, lastRows] = await Promise.all([
    prisma.$queryRaw<Row[]>`
      SELECT count(*)::int AS attempts,
             count(*) FILTER (WHERE is_correct)::int AS correct,
             count(DISTINCT question_id)::int AS distinct_questions,
             count(DISTINCT question_id) FILTER (WHERE NOT is_correct)::int AS wrong_questions,
             count(*) FILTER (WHERE (answered_at AT TIME ZONE ${TIME_ZONE})::date = ${today}::date)::int AS today,
             avg(response_time_ms) FILTER (WHERE response_time_ms BETWEEN 1000 AND 3600000) AS avg_ms
      FROM study_answer_attempts
      WHERE profile_id = ${profileId}::uuid`,
    prisma.$queryRaw<Row[]>`
      SELECT DISTINCT to_char((answered_at AT TIME ZONE ${TIME_ZONE})::date, 'YYYY-MM-DD') AS day
      FROM study_answer_attempts
      WHERE profile_id = ${profileId}::uuid
        AND answered_at >= now() - interval '400 days'`,
    prisma.$queryRaw<Row[]>`
      SELECT to_char(date_trunc('week', answered_at AT TIME ZONE ${TIME_ZONE})::date, 'YYYY-MM-DD') AS week_start,
             count(*)::int AS attempts,
             count(*) FILTER (WHERE is_correct)::int AS correct
      FROM study_answer_attempts
      WHERE profile_id = ${profileId}::uuid
        AND (answered_at AT TIME ZONE ${TIME_ZONE})::date >= ${firstWeek}::date
      GROUP BY 1`,
    prisma.$queryRaw<Row[]>`
      SELECT d.id AS discipline_id, d.name,
             count(*)::int AS attempts,
             count(*) FILTER (WHERE a.is_correct)::int AS correct
      FROM study_answer_attempts a
      JOIN questions q ON q.id = a.question_id
      JOIN disciplines d ON d.id = q.discipline_id
      WHERE a.profile_id = ${profileId}::uuid
      GROUP BY d.id, d.name
      ORDER BY attempts DESC, d.name`,
    prisma.$queryRaw<Row[]>`
      SELECT ar.id AS area_id, ar.name, d.id AS discipline_id, d.name AS discipline_name,
             count(*)::int AS attempts,
             count(*) FILTER (WHERE a.is_correct)::int AS correct
      FROM study_answer_attempts a
      JOIN questions q ON q.id = a.question_id
      JOIN areas ar ON ar.id = q.area_id
      JOIN disciplines d ON d.id = q.discipline_id
      WHERE a.profile_id = ${profileId}::uuid
      GROUP BY ar.id, ar.name, d.id, d.name`,
    prisma.$queryRaw<Row[]>`
      SELECT d.id AS discipline_id, d.name AS discipline_name, a.answered_at
      FROM study_answer_attempts a
      JOIN questions q ON q.id = a.question_id
      JOIN disciplines d ON d.id = q.discipline_id
      WHERE a.profile_id = ${profileId}::uuid
      ORDER BY a.answered_at DESC
      LIMIT 1`,
  ]);

  const totals = totalsRows[0] ?? {};
  const weeks = buildWeeks(
    weekRows.map((row) => ({
      weekStart: String(row.week_start),
      attempts: toNumber(row.attempts),
      correct: toNumber(row.correct),
    })),
    today,
  );
  const averageMs = totals.avg_ms === null || totals.avg_ms === undefined ? null : Number(totals.avg_ms);

  return {
    totals: {
      attempts: toNumber(totals.attempts),
      correct: toNumber(totals.correct),
      distinctQuestions: toNumber(totals.distinct_questions),
      thisWeek: weeks[weeks.length - 1]?.attempts ?? 0,
      today: toNumber(totals.today),
      wrongQuestions: toNumber(totals.wrong_questions),
      averageResponseSeconds: averageMs === null || Number.isNaN(averageMs) ? null : Math.round(averageMs / 1000),
      streakDays: countStreak(new Set(dayRows.map((row) => String(row.day))), today),
    },
    weeks,
    disciplines: disciplineRows.map((row) => ({
      disciplineId: String(row.discipline_id),
      name: String(row.name),
      attempts: toNumber(row.attempts),
      correct: toNumber(row.correct),
    })),
    topics: topicRows.map((row) => ({
      areaId: String(row.area_id),
      name: String(row.name),
      disciplineId: String(row.discipline_id),
      disciplineName: String(row.discipline_name),
      attempts: toNumber(row.attempts),
      correct: toNumber(row.correct),
    })),
    lastActivity: lastRows[0]
      ? {
          disciplineId: String(lastRows[0].discipline_id),
          disciplineName: String(lastRows[0].discipline_name),
          answeredAt: new Date(String(lastRows[0].answered_at)),
        }
      : null,
  };
}

/** Lowest hit rate first, among topics with enough answers. */
export function weakestTopics(topics: readonly TopicPerformance[], limit = 5): TopicPerformance[] {
  return topics
    .filter((topic) => topic.attempts >= WEAK_TOPIC_MIN_ATTEMPTS && topic.correct < topic.attempts)
    .sort((left, right) => left.correct / left.attempts - right.correct / right.attempts || right.attempts - left.attempts)
    .slice(0, limit);
}
