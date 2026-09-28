import Link from "next/link";

import { listPosts, type PostListFilters } from "@/modules/blog/infrastructure/blog-queries";

import styles from "../portal.module.css";
import { ListItem } from "./post-cards";
import { BlogSidebar } from "./sidebar";

/** A paginated list of live posts (latest news, editorial, region, search). */
export async function PostListPage({
  eyebrow,
  title,
  description,
  filters,
  page,
  basePath,
  query,
  activeCategory,
}: Readonly<{
  eyebrow: string;
  title: string;
  description?: string;
  filters: PostListFilters;
  page: number;
  basePath: string;
  /** Extra query string kept across pages (e.g. the search). */
  query?: Record<string, string>;
  activeCategory?: string | null;
}>) {
  const now = new Date();
  const { posts, total, totalPages } = await listPosts(filters, page, now);

  const pageHref = (target: number) => {
    const params = new URLSearchParams(query);
    if (target > 1) params.set("pagina", String(target));
    const text = params.toString();
    return text ? `${basePath}?${text}` : basePath;
  };

  return (
    <div className={styles.columns}>
      <div className={styles.main}>
        <header className={styles.listHeader}>
          <span className={styles.kicker}>{eyebrow}</span>
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
          <small>
            {total} {total === 1 ? "publicação" : "publicações"}
          </small>
        </header>

        {posts.length === 0 ? (
          <p className={styles.empty}>
            Nada publicado aqui ainda. <Link href="/blog">Voltar ao início do blog</Link>
          </p>
        ) : (
          <div className={styles.list}>
            {posts.map((post) => (
              <ListItem key={post.slug} post={post} now={now} />
            ))}
          </div>
        )}

        {totalPages > 1 ? (
          <nav className={styles.pager} aria-label="Paginação">
            {page > 1 ? <Link href={pageHref(page - 1)}>← Mais recentes</Link> : <span />}
            <span>
              Página {page} de {totalPages}
            </span>
            {page < totalPages ? <Link href={pageHref(page + 1)}>Mais antigas →</Link> : <span />}
          </nav>
        ) : null}
      </div>
      <BlogSidebar activeSlug={activeCategory} />
    </div>
  );
}

export function parsePage(value: string | undefined): number {
  return Math.max(1, Math.min(10_000, Math.trunc(Number(value)) || 1));
}
