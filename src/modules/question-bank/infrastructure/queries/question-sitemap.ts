import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

/** URLs per question sitemap (Google accepts up to 50,000). */
export const QUESTION_SITEMAP_SIZE = 45_000;

/**
 * Question sitemaps split by public number ranges: stable ids, no OFFSET
 * over millions of rows. Sitemap n covers [first + n·size, first + (n+1)·size).
 */
export async function questionSitemapRange(): Promise<{ first: number; count: number }> {
  const bounds = await getPrismaClient().question.aggregate({
    where: { status: "PUBLISHED" },
    _min: { publicNumber: true },
    _max: { publicNumber: true },
  });
  const first = bounds._min.publicNumber;
  const last = bounds._max.publicNumber;

  if (first === null || last === null) {
    return { first: 0, count: 0 };
  }

  return { first, count: Math.floor((last - first) / QUESTION_SITEMAP_SIZE) + 1 };
}

export async function questionSitemapEntries(index: number): Promise<{ code: string; updatedAt: Date }[]> {
  const { first } = await questionSitemapRange();
  const from = first + index * QUESTION_SITEMAP_SIZE;

  const rows = await getPrismaClient().question.findMany({
    where: { status: "PUBLISHED", publicNumber: { gte: from, lt: from + QUESTION_SITEMAP_SIZE } },
    orderBy: { publicNumber: "asc" },
    select: { publicNumber: true, updatedAt: true },
  });

  return rows.map((row) => ({ code: `Q${row.publicNumber}`, updatedAt: row.updatedAt }));
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
