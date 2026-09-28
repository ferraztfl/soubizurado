import type { MetadataRoute } from "next";

import { livePostsWhere } from "@/modules/blog/infrastructure/blog-queries";
import { siteUrl } from "@/modules/question-bank/infrastructure/queries/question-sitemap";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

/** Live posts, at /blog/sitemap.xml (listed in robots.txt). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const posts = await getPrismaClient().blogPost.findMany({
    where: livePostsWhere(new Date()),
    orderBy: { publishedAt: "desc" },
    take: 45_000,
    select: { slug: true, updatedAt: true },
  });

  return [
    { url: `${base}/blog`, changeFrequency: "daily", priority: 0.8 },
    ...posts.map((post) => ({
      url: `${base}/blog/${post.slug}`,
      lastModified: post.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
