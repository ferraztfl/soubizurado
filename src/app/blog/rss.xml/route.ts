import { livePostsWhere } from "@/modules/blog/infrastructure/blog-queries";
import { siteUrl } from "@/modules/question-bank/infrastructure/queries/question-sitemap";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

export const dynamic = "force-dynamic";

function xml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** RSS 2.0 feed of the latest live posts (news aggregators, readers). */
export async function GET(): Promise<Response> {
  const base = siteUrl();
  const posts = await getPrismaClient().blogPost.findMany({
    where: livePostsWhere(new Date()),
    orderBy: { publishedAt: "desc" },
    take: 50,
    select: { slug: true, title: true, excerpt: true, publishedAt: true, category: { select: { name: true } } },
  });

  const items = posts
    .map(
      (post) => `    <item>
      <title>${xml(post.title)}</title>
      <link>${xml(`${base}/blog/${post.slug}`)}</link>
      <guid isPermaLink="true">${xml(`${base}/blog/${post.slug}`)}</guid>
      <description>${xml(post.excerpt)}</description>
      ${post.category ? `<category>${xml(post.category.name)}</category>` : ""}
      <pubDate>${post.publishedAt?.toUTCString() ?? ""}</pubDate>
    </item>`,
    )
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Sou Bizurado — notícias de concursos</title>
    <link>${xml(`${base}/blog`)}</link>
    <atom:link href="${xml(`${base}/blog/rss.xml`)}" rel="self" type="application/rss+xml" />
    <description>Editais, datas de provas, salários e dicas de estudo para concursos públicos.</description>
    <language>pt-BR</language>
${items}
  </channel>
</rss>`;

  return new Response(body, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=900" },
  });
}
