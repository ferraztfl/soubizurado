import { accuracyOf, RANKING_SIZE, type RankingEntry } from "@/modules/study/domain/ranking";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

type Row = Readonly<{
  position: bigint | number;
  profile_id: string;
  display_name: string | null;
  points: bigint | number;
  answered: bigint | number;
  participants: bigint | number;
}>;

export type RankingResult = Readonly<{
  top: readonly RankingEntry[];
  /** The viewer's row when outside the top (null when not ranked or hidden). */
  me: RankingEntry | null;
  participants: number;
}>;

/**
 * Ranking since `startDay` (a São Paulo date). Only students who did not opt
 * out (study_preferences.show_in_ranking; no row = visible); only their
 * display name leaves the database.
 */
export async function loadRanking(startDay: string, viewerProfileId: string | null): Promise<RankingResult> {
  // Midnight in São Paulo (UTC−3, no DST since 2019).
  const since = new Date(`${startDay}T03:00:00Z`);

  const rows = await getPrismaClient().$queryRaw<Row[]>`
    WITH scores AS (
      SELECT a.profile_id,
             count(DISTINCT a.question_id) FILTER (WHERE a.is_correct) AS points,
             count(DISTINCT a.question_id) AS answered
      FROM study_answer_attempts a
      WHERE a.answered_at >= ${since}
      GROUP BY a.profile_id
    ),
    ranked AS (
      SELECT s.profile_id, p.display_name, s.points, s.answered,
             row_number() OVER (
               ORDER BY s.points DESC,
                        s.points::float / NULLIF(s.answered, 0) DESC,
                        s.answered ASC,
                        p.created_at ASC
             ) AS position,
             count(*) OVER () AS participants
      FROM scores s
      JOIN profiles p ON p.id = s.profile_id
      LEFT JOIN study_preferences sp ON sp.profile_id = s.profile_id
      WHERE COALESCE(sp.show_in_ranking, true)
    )
    SELECT position, profile_id, display_name, points, answered, participants
    FROM ranked
    WHERE position <= ${RANKING_SIZE} OR profile_id = ${viewerProfileId}::uuid
    ORDER BY position`;

  const entries = rows.map((row) => ({
    position: Number(row.position),
    profileId: row.profile_id,
    name: row.display_name?.trim() || "Estudante",
    points: Number(row.points),
    answered: Number(row.answered),
    accuracy: accuracyOf(Number(row.points), Number(row.answered)),
  }));
  const participants = Number(rows[0]?.participants ?? 0);

  return {
    top: entries.filter((entry) => entry.position <= RANKING_SIZE),
    me: entries.find((entry) => entry.profileId === viewerProfileId && entry.position > RANKING_SIZE) ?? null,
    participants,
  };
}
