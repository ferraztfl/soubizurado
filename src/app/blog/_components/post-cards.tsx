import Link from "next/link";

import { readingMinutes, relativePublishedAt } from "@/modules/blog/domain/blog";
import { blogImageUrl, type PostCard } from "@/modules/blog/infrastructure/blog-queries";

import styles from "../portal.module.css";

function Cover({ post, className }: Readonly<{ post: PostCard; className: string }>) {
  return post.coverAssetId ? (
    // eslint-disable-next-line @next/next/no-img-element -- protected media route
    <img src={blogImageUrl(post.coverAssetId)} alt="" className={className} loading="lazy" decoding="async" />
  ) : (
    <div className={`${className} ${styles.coverFallback}`} aria-hidden="true">
      <span>{post.category?.name ?? (post.format === "ARTICLE" ? "Artigo" : "Concursos")}</span>
    </div>
  );
}

export function AuthorLine({ post, now }: Readonly<{ post: PostCard; now: Date }>) {
  const name = post.author?.displayName?.trim() || "Redação Sou Bizurado";

  return (
    <div className={styles.author}>
      <span className={styles.avatar} aria-hidden="true">
        {name.charAt(0).toUpperCase()}
      </span>
      <span>
        <strong>{name}</strong>
        <small>{post.publishedAt ? relativePublishedAt(post.publishedAt, now) : ""}</small>
      </span>
    </div>
  );
}

export function HeroPost({ post, now }: Readonly<{ post: PostCard; now: Date }>) {
  return (
    <article className={styles.hero}>
      <Link href={`/blog/${post.slug}`} className={styles.heroImageLink} tabIndex={-1} aria-hidden="true">
        <Cover post={post} className={styles.heroImage} />
      </Link>
      <div className={styles.heroText}>
        {post.category ? (
          <Link href={`/blog/editoria/${post.category.slug}`} className={styles.kicker}>
            {post.category.name}
          </Link>
        ) : null}
        <h2>
          <Link href={`/blog/${post.slug}`}>{post.title}</Link>
        </h2>
        <p>{post.excerpt}</p>
        <AuthorLine post={post} now={now} />
      </div>
    </article>
  );
}

export function GridCard({ post, now }: Readonly<{ post: PostCard; now: Date }>) {
  return (
    <article className={styles.gridCard}>
      <Link href={`/blog/${post.slug}`} className={styles.gridLink}>
        <Cover post={post} className={styles.gridImage} />
        <h3>{post.title}</h3>
      </Link>
      <span className={styles.byline}>
        <strong>{post.author?.displayName?.trim() || "Redação"}</strong> · {post.publishedAt ? relativePublishedAt(post.publishedAt, now) : ""}
      </span>
    </article>
  );
}

export function ListItem({ post, now }: Readonly<{ post: PostCard; now: Date }>) {
  return (
    <article className={styles.listItem}>
      <Link href={`/blog/${post.slug}`} className={styles.listThumbLink} tabIndex={-1} aria-hidden="true">
        <Cover post={post} className={styles.listThumb} />
      </Link>
      <div>
        <h3>
          <Link href={`/blog/${post.slug}`}>{post.title}</Link>
        </h3>
        <span className={styles.byline}>
          <strong>{post.author?.displayName?.trim() || "Redação"}</strong> · {post.publishedAt ? relativePublishedAt(post.publishedAt, now) : ""}
          {post.stateCode ? ` · ${post.stateCode}` : ""}
        </span>
      </div>
    </article>
  );
}

export function ArticleCard({ post }: Readonly<{ post: PostCard }>) {
  return (
    <article className={styles.articleCard}>
      <Link href={`/blog/${post.slug}`} className={styles.gridLink}>
        <Cover post={post} className={styles.articleImage} />
        <h3>{post.title}</h3>
        <p>{post.excerpt}</p>
        <span className={styles.byline}>{readingMinutes(post.body)} min de leitura</span>
      </Link>
    </article>
  );
}
