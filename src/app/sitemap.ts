import type { MetadataRoute } from "next";

import { siteUrl } from "@/modules/question-bank/infrastructure/queries/question-sitemap";

/** Public entry pages; questions (/questoes/sitemap/[id].xml) and posts (/blog/sitemap.xml) have their own. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();

  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/questoes`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/loja`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/cadastro`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${base}/termos`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/privacidade`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
