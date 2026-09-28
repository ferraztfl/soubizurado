import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { readingMinutes } from "@/modules/blog/domain/blog";
import { blogImageUrl, loadLivePost } from "@/modules/blog/infrastructure/blog-queries";
import { siteUrl } from "@/modules/question-bank/infrastructure/queries/question-sitemap";
import { formatBRL } from "@/modules/store/domain/store";

import { ArticleBody } from "../article-body";
import styles from "../blog.module.css";

export const dynamic = "force-dynamic";

type PostPageProps = Readonly<{ params: Promise<{ slug: string }> }>;

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" });

const loadPost = cache((slug: string) => (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) ? loadLivePost(slug, new Date()) : null));

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const post = await loadPost((await params).slug);

  if (!post) {
    return { title: "Post não encontrado", robots: { index: false } };
  }

  const image = post.coverAssetId ? `${siteUrl()}${blogImageUrl(post.coverAssetId)}` : undefined;

  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      url: `/blog/${post.slug}`,
      siteName: "Sou Bizurado",
      locale: "pt_BR",
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: { card: image ? "summary_large_image" : "summary", title: post.title, description: post.excerpt },
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const post = await loadPost((await params).slug);

  if (!post) {
    notFound();
  }

  const base = siteUrl();
  const images = new Map(post.images.map((image) => [image.position, blogImageUrl(image.mediaAssetId)]));
  const offer = post.relatedOffer?.isActive ? post.relatedOffer : null;

  // Structured data for Google (News / Top stories). "<" is escaped so the
  // JSON can never close the script tag.
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    mainEntityOfPage: `${base}/blog/${post.slug}`,
    ...(post.coverAssetId ? { image: [`${base}${blogImageUrl(post.coverAssetId)}`] } : {}),
    author: { "@type": "Organization", name: "Sou Bizurado" },
    publisher: { "@type": "Organization", name: "Sou Bizurado", logo: { "@type": "ImageObject", url: `${base}/brand/logo-horizontal.png` } },
  }).replace(/</g, "\\u003c");

  return (
    <article className={styles.post}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      <header className={styles.postHeader}>
        <Link href="/blog" className={styles.back}>
          ← Blog
        </Link>
        {post.category ? (
          <Link href={`/blog?categoria=${post.category.slug}`} className={styles.eyebrow}>
            {post.category.name}
          </Link>
        ) : null}
        <h1>{post.title}</h1>
        <p className={styles.lead}>{post.excerpt}</p>
        <span className={styles.meta}>
          {post.publishedAt ? dateFormatter.format(post.publishedAt) : ""} · {readingMinutes(post.body)} min de leitura
          {post.author?.displayName ? ` · por ${post.author.displayName}` : ""}
        </span>
      </header>

      {post.coverAssetId ? (
        // eslint-disable-next-line @next/next/no-img-element -- protected media route
        <img src={blogImageUrl(post.coverAssetId)} alt="" className={styles.cover} />
      ) : null}

      <ArticleBody body={post.body} images={images} />

      {offer || post.relatedBoard ? (
        <aside className={styles.cta} aria-label="Estude para este concurso">
          <strong>Estude para este concurso no Sou Bizurado</strong>
          {post.relatedBoard ? (
            <Link href={`/questoes?board=${post.relatedBoard.id}`} className={styles.ctaSecondary}>
              Resolver questões da banca {post.relatedBoard.name} grátis
            </Link>
          ) : null}
          {offer ? (
            <Link href={`/loja/${offer.slug}`} className={styles.ctaPrimary}>
              {offer.name} — {formatBRL(offer.priceCents)}
            </Link>
          ) : null}
        </aside>
      ) : (
        <aside className={styles.cta}>
          <strong>Treine com questões de concursos</strong>
          <Link href="/questoes" className={styles.ctaPrimary}>
            Resolver questões grátis
          </Link>
        </aside>
      )}

      {post.related.length > 0 ? (
        <section className={styles.related}>
          <h2>Leia também</h2>
          <ul>
            {post.related.map((item) => (
              <li key={item.slug}>
                <Link href={`/blog/${item.slug}`}>{item.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
