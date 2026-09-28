import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { BRAZIL_STATES, parseStateCode, readingMinutes } from "@/modules/blog/domain/blog";
import { blogImageUrl, loadLivePost } from "@/modules/blog/infrastructure/blog-queries";
import { siteUrl } from "@/modules/question-bank/infrastructure/queries/question-sitemap";
import { formatBRL } from "@/modules/store/domain/store";

import { ArticleBody } from "../article-body";
import { AuthorLine, GridCard, ListItem } from "../_components/post-cards";
import { BlogSidebar } from "../_components/sidebar";
import styles from "../portal.module.css";

export const dynamic = "force-dynamic";

type PostPageProps = Readonly<{ params: Promise<{ slug: string }> }>;

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

function ShareLinks({ url, title }: Readonly<{ url: string; title: string }>) {
  const text = encodeURIComponent(`${title} ${url}`);
  const link = encodeURIComponent(url);
  const targets = [
    { name: "WhatsApp", href: `https://wa.me/?text=${text}` },
    { name: "Telegram", href: `https://t.me/share/url?url=${link}&text=${encodeURIComponent(title)}` },
    { name: "X", href: `https://twitter.com/intent/tweet?url=${link}&text=${encodeURIComponent(title)}` },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${link}` },
    { name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${link}` },
  ];

  return (
    <div className={styles.share} aria-label="Compartilhar">
      <span>Compartilhe:</span>
      {targets.map((target) => (
        <a key={target.name} href={target.href} target="_blank" rel="noopener noreferrer">
          {target.name}
        </a>
      ))}
    </div>
  );
}

export default async function PostPage({ params }: PostPageProps) {
  const post = await loadPost((await params).slug);

  if (!post) {
    notFound();
  }

  const now = new Date();
  const base = siteUrl();
  const url = `${base}/blog/${post.slug}`;
  const images = new Map(post.images.map((image) => [image.position, blogImageUrl(image.mediaAssetId)]));
  const offer = post.relatedOffer?.isActive ? post.relatedOffer : null;
  const state = parseStateCode(post.stateCode);

  // Structured data for Google (News / Top stories). "<" is escaped so the
  // JSON can never close the script tag.
  const jsonLd = JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": post.format === "ARTICLE" ? "Article" : "NewsArticle",
      headline: post.title,
      description: post.excerpt,
      datePublished: post.publishedAt?.toISOString(),
      dateModified: post.updatedAt.toISOString(),
      mainEntityOfPage: url,
      ...(post.coverAssetId ? { image: [`${base}${blogImageUrl(post.coverAssetId)}`] } : {}),
      author: post.author?.displayName
        ? { "@type": "Person", name: post.author.displayName }
        : { "@type": "Organization", name: "Sou Bizurado" },
      publisher: { "@type": "Organization", name: "Sou Bizurado", logo: { "@type": "ImageObject", url: `${base}/brand/logo-horizontal.png` } },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Blog", item: `${base}/blog` },
        ...(post.category ? [{ "@type": "ListItem", position: 2, name: post.category.name, item: `${base}/blog/editoria/${post.category.slug}` }] : []),
        { "@type": "ListItem", position: post.category ? 3 : 2, name: post.title, item: url },
      ],
    },
  ]).replace(/</g, "\\u003c");

  const authorCard = {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    body: post.body,
    format: post.format,
    stateCode: post.stateCode,
    isFeatured: false,
    publishedAt: post.publishedAt,
    coverAssetId: post.coverAssetId,
    category: post.category,
    author: post.author,
  };

  return (
    <div className={styles.columns}>
      <article className={styles.main}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

        <nav className={styles.breadcrumb} aria-label="Você está em">
          <Link href="/blog">Blog</Link>
          {post.category ? (
            <>
              <span aria-hidden="true">›</span>
              <Link href={`/blog/editoria/${post.category.slug}`}>{post.category.name}</Link>
            </>
          ) : null}
          {state ? (
            <>
              <span aria-hidden="true">›</span>
              <Link href={`/blog/regiao/${state.toLowerCase()}`}>{BRAZIL_STATES[state]}</Link>
            </>
          ) : null}
        </nav>

        <header className={styles.postHeader}>
          <h1>{post.title}</h1>
          <p className={styles.lead}>{post.excerpt}</p>
          <div className={styles.postMeta}>
            <AuthorLine post={authorCard} now={now} />
            <span className={styles.muted}>{readingMinutes(post.body)} min de leitura</span>
          </div>
          <ShareLinks url={url} title={post.title} />
        </header>

        {post.coverAssetId ? (
          // eslint-disable-next-line @next/next/no-img-element -- protected media route
          <img src={blogImageUrl(post.coverAssetId)} alt="" className={styles.postCover} />
        ) : null}

        <ArticleBody body={post.body} images={images} />

        <aside className={styles.cta} aria-label="Estude para este concurso">
          <strong>{offer || post.relatedBoard ? "Estude para este concurso no Sou Bizurado" : "Treine com questões de concursos"}</strong>
          <div>
            <Link href={post.relatedBoard ? `/questoes?board=${post.relatedBoard.id}` : "/questoes"} className={styles.ctaSecondary}>
              {post.relatedBoard ? `Resolver questões da banca ${post.relatedBoard.name} grátis` : "Resolver questões grátis"}
            </Link>
            {offer ? (
              <Link href={`/loja/${offer.slug}`} className={styles.ctaPrimary}>
                {offer.name} — {formatBRL(offer.priceCents)}
              </Link>
            ) : null}
          </div>
        </aside>

        <ShareLinks url={url} title={post.title} />

        {post.related.length > 0 ? (
          <section>
            <div className={styles.sectionHead}>
              <h2>Leia também</h2>
            </div>
            <div className={styles.relatedGrid}>
              {post.related.map((item) => (
                <GridCard key={item.slug} post={item} now={now} />
              ))}
            </div>
          </section>
        ) : null}
      </article>

      <div className={styles.sideStack}>
        {post.latest.length > 0 ? (
          <section className={styles.sideLatest} aria-label="Últimas notícias">
            <h2>Últimas notícias</h2>
            {post.latest.map((item) => (
              <ListItem key={item.slug} post={item} now={now} />
            ))}
          </section>
        ) : null}
        <BlogSidebar activeSlug={post.category?.slug} />
      </div>
    </div>
  );
}
