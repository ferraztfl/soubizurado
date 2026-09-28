import { unstable_cache } from "next/cache";

import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

type NamedCount = Readonly<{ id: string; name: string; count: number }>;

export type HomeHighlights = Readonly<{
  questions: number;
  boards: number;
  organizations: number;
  disciplineCount: number;
  disciplines: NamedCount[];
  topBoards: NamedCount[];
}>;

/**
 * Real numbers for the public home page: published questions, and the
 * disciplines / boards with the most published questions. Counting a large
 * table on every visit is wasteful, so the result is cached for an hour.
 */
export const loadHomeHighlights = unstable_cache(
  async (): Promise<HomeHighlights> => {
    const prisma = getPrismaClient();

    const [questions, disciplines, boards, totals] = await Promise.all([
      prisma.question.count({ where: { status: "PUBLISHED" } }),
      prisma.$queryRaw<{ id: string; name: string; count: bigint }[]>`
        SELECT d.id, d.name, COUNT(*) AS count
        FROM questions q
        JOIN disciplines d ON d.id = q.discipline_id
        WHERE q.status = 'PUBLISHED' AND d.is_active
        GROUP BY d.id, d.name
        ORDER BY count DESC, d.name
        LIMIT 12`,
      prisma.$queryRaw<{ id: string; name: string; count: bigint }[]>`
        SELECT b.id, b.name, COUNT(*) AS count
        FROM questions q
        JOIN examinations e ON e.id = q.examination_id
        JOIN examining_boards b ON b.id = e.board_id
        WHERE q.status = 'PUBLISHED' AND b.is_active
        GROUP BY b.id, b.name
        ORDER BY count DESC, b.name
        LIMIT 12`,
      prisma.$queryRaw<{ boards: bigint; organizations: bigint; disciplines: bigint }[]>`
        SELECT COUNT(DISTINCT e.board_id) AS boards, COUNT(DISTINCT e.organization_id) AS organizations,
          COUNT(DISTINCT q.discipline_id) AS disciplines
        FROM questions q
        LEFT JOIN examinations e ON e.id = q.examination_id
        WHERE q.status = 'PUBLISHED'`,
    ]);

    const toNamed = (rows: { id: string; name: string; count: bigint }[]) =>
      rows.map((row) => ({ id: row.id, name: row.name, count: Number(row.count) }));

    return {
      questions,
      boards: Number(totals[0]?.boards ?? 0),
      organizations: Number(totals[0]?.organizations ?? 0),
      disciplineCount: Number(totals[0]?.disciplines ?? 0),
      disciplines: toNamed(disciplines),
      topBoards: toNamed(boards),
    };
  },
  ["home-highlights-v2"],
  { revalidate: 3600 },
);
