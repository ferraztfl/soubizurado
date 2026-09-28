import type { MetadataRoute } from "next";

import { publishedContestSlugs } from "@/modules/contests/infrastructure/contest-queries";
import { siteUrl } from "@/modules/question-bank/infrastructure/queries/question-sitemap";

/** Public entry pages and contests; questions (/questoes/sitemap/[id].xml) and posts (/blog/sitemap.xml) have their own. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const contests = await publishedContestSlugs();

  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/questoes`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/concursos`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/loja`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/cadastro`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${base}/termos`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/privacidade`, changeFrequency: "yearly", priority: 0.2 },
    ...contests.map((contest) => ({
      url: `${base}/concursos/${contest.slug}`,
      lastModified: contest.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
