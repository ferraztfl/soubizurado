import type { MetadataRoute } from "next";

import { questionSitemapRange, siteUrl } from "@/modules/question-bank/infrastructure/queries/question-sitemap";

/** Search engines: the public question bank yes; private areas and APIs no. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = siteUrl();
  const { count } = await questionSitemapRange();

  return {
    rules: {
      userAgent: "*",
      // Blog images feed article rich results / social cards (more specific than /api/).
      allow: ["/", "/questoes", "/blog", "/loja", "/api/blog/imagens/"],
      disallow: ["/admin", "/api/", "/auth/", "/definir-senha", "/app/perfil", "/app/configuracoes", "/app/estudar"],
    },
    sitemap: [
      `${base}/sitemap.xml`,
      `${base}/blog/sitemap.xml`,
      ...Array.from({ length: Math.max(count, 1) }, (_, id) => `${base}/questoes/sitemap/${id}.xml`),
    ],
  };
}
