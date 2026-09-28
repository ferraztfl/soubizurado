import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { BRAZIL_STATES, parseStateCode, readingMinutes } from "@/modules/blog/domain/blog";
import { blogImageUrl, loadLivePost } from "@/modules/blog/infrastructure/blog-queries";
import { siteUrl } from "@/modules/question-bank/infrastructure/queries/question-sitemap";
import { formatBRL } from "@/modules/store/domain/store";
import { DEFAULT_SUBSCRIPTION_PLAN, SUBSCRIPTION_PLANS } from "@/modules/store/domain/subscription";

import { ArticleBody } from "../article-body";
import { GridCard, ListItem } from "../_components/post-cards";
import { ReadingProgress } from "../_components/reading-progress";
import { ShareButtons } from "../_components/share-buttons";
import styles from "../portal.module.css";

export const dynamic = "force-dynamic";

const longDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

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

  const published = post.publishedAt ?? post.updatedAt;
  const edited = post.updatedAt.getTime() - published.getTime() > 3_600_000;
  const author = post.author?.displayName ?? "Redação Sou Bizurado";
  const initials = author
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <article className={styles.story}>
      <ReadingProgress />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      <header className={styles.storyHeader}>
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
        {post.category ? (
          <Link href={`/blog/editoria/${post.category.slug}`} className={styles.kicker}>
            {post.category.name}
          </Link>
        ) : null}
        <h1>{post.title}</h1>
        <p className={styles.lead}>{post.excerpt}</p>
        <div className={styles.storyMeta}>
          <div className={styles.storyByline}>
            <span className={styles.avatar} aria-hidden="true">
              {initials || "SB"}
            </span>
            <span>
              <strong>{author}</strong>
              <small>
                <time dateTime={published.toISOString()}>{longDate.format(published)}</time>
                {edited ? <> · atualizado em {longDate.format(post.updatedAt)}</> : null} · {readingMinutes(post.body)} min de leitura
              </small>
            </span>
          </div>
          <ShareButtons url={url} title={post.title} layout="row" />
        </div>
      </header>

      {post.coverAssetId ? (
        // eslint-disable-next-line @next/next/no-img-element -- protected media route
        <img src={blogImageUrl(post.coverAssetId)} alt="" className={styles.storyCover} />
      ) : null}

      <div className={styles.storyBody}>
        <ShareButtons url={url} title={post.title} layout="rail" />

        <div className={styles.storyText}>
          <ArticleBody body={post.body} images={images} />

          <aside className={styles.cta} aria-label="Estude para este concurso">
            <strong>{offer || post.relatedBoard ? "Estude para este concurso no Sou Bizurado" : "Leu a notícia? Agora é treinar."}</strong>
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

          <aside className={styles.premiumInvite} aria-label="Assinatura Premium">
            <div>
              <span>Sou Bizurado Premium</span>
              <strong>Questões e simulados ilimitados por {formatBRL(SUBSCRIPTION_PLANS[DEFAULT_SUBSCRIPTION_PLAN].amountCents)}/mês</strong>
              <p>Revisão dos seus erros, desempenho por matéria e ranking. Cancele quando quiser.</p>
            </div>
            <Link href="/assinatura">Quero assinar</Link>
          </aside>

          <ShareButtons url={url} title={post.title} layout="row" />
        </div>
      </div>

      {post.related.length > 0 ? (
        <section className={styles.storySection}>
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

      {post.latest.length > 0 ? (
        <section className={styles.storySection} aria-label="Últimas notícias">
          <div className={styles.sectionHead}>
            <h2>Últimas notícias</h2>
            <Link href="/blog/noticias">Ver todas →</Link>
          </div>
          <div className={styles.list}>
            {post.latest.map((item) => (
              <ListItem key={item.slug} post={item} now={now} />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
