import { addDays } from "@/modules/study/domain/spaced-review";
import type { MissionProgressInput } from "@/modules/study/domain/missions";
import { countDueReviews } from "@/modules/study/infrastructure/sessions/study-session-store";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import { loadStudyPreferences, todayInSaoPaulo } from "./study-preferences";

/** Monday (YYYY-MM-DD) of the week that contains `day`. */
export function mondayOf(day: string): string {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}

/** Midnight of a São Paulo day as an instant (Brazil has no DST since 2019: UTC−3). */
const startOfLocalDay = (day: string) => new Date(`${day}T03:00:00Z`);

type Row = Readonly<{
  attempts_today: bigint | number;
  correct_today: bigint | number;
  attempts_week: bigint | number;
  correct_week: bigint | number;
  active_days: bigint | number;
}>;

/** Everything the missions need, for one student, now. */
export async function loadMissionProgress(profileId: string, now = new Date()): Promise<MissionProgressInput & { weekStart: string }> {
  const prisma = getPrismaClient();
  const today = todayInSaoPaulo(now);
  const monday = mondayOf(today);
  const weekStart = startOfLocalDay(monday);

  const [rows, preferences, dueReviews, finishedSessions, finishedSimulations] = await Promise.all([
    prisma.$queryRaw<Row[]>`
      SELECT
        count(*) FILTER (WHERE local_day = ${today}::date) AS attempts_today,
        count(*) FILTER (WHERE local_day = ${today}::date AND is_correct) AS correct_today,
        count(*) AS attempts_week,
        count(*) FILTER (WHERE is_correct) AS correct_week,
        count(DISTINCT local_day) AS active_days
      FROM (
        SELECT (answered_at AT TIME ZONE 'America/Sao_Paulo')::date AS local_day, is_correct
        FROM study_answer_attempts
        WHERE profile_id = ${profileId}::uuid AND answered_at >= ${weekStart}
      ) AS week_attempts`,
    loadStudyPreferences(profileId),
    countDueReviews(profileId, today),
    prisma.studySession.count({ where: { profileId, status: "FINISHED", finishedAt: { gte: weekStart } } }),
    prisma.studySimulation.count({ where: { profileId, status: "FINISHED", finishedAt: { gte: weekStart } } }),
  ]);

  const row = rows[0];
  const n = (value: bigint | number | undefined) => Number(value ?? 0);

  return {
    weekStart: monday,
    dailyGoal: preferences.dailyGoal,
    today: { attempts: n(row?.attempts_today), correct: n(row?.correct_today) },
    dueReviews,
    week: {
      attempts: n(row?.attempts_week),
      correct: n(row?.correct_week),
      activeDays: n(row?.active_days),
      finishedSessions,
      finishedSimulations,
    },
  };
}
