import type { MetadataRoute } from "next";

import {
  questionSitemapEntries,
  questionSitemapRange,
  siteUrl,
} from "@/modules/question-bank/infrastructure/queries/question-sitemap";

/** Published questions, served at /questoes/sitemap/[id].xml (listed in robots.txt). */
export async function generateSitemaps() {
  const { count } = await questionSitemapRange();

  return Array.from({ length: Math.max(count, 1) }, (_, id) => ({ id }));
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const index = Number(await props.id);
  const base = siteUrl();

  if (!Number.isSafeInteger(index) || index < 0) {
    return [];
  }

  return (await questionSitemapEntries(index)).map((entry) => ({
    url: `${base}/questoes/${entry.code}`,
    lastModified: entry.updatedAt,
    changeFrequency: "monthly",
    priority: 0.7,
  }));
}
