import type { MetadataRoute } from "next";

import { siteUrl } from "@/modules/question-bank/infrastructure/queries/question-sitemap";

/** Public entry pages; each question has its own sitemaps (/questoes/sitemap/[id].xml). */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();

  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/questoes`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/cadastro`, changeFrequency: "yearly", priority: 0.5 },
  ];
}
