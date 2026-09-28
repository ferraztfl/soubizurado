import type { Metadata } from "next";
import Link from "next/link";

import { readingMinutes } from "@/modules/blog/domain/blog";
import { blogImageUrl, listLivePosts } from "@/modules/blog/infrastructure/blog-queries";

import styles from "./blog.module.css";

export const dynamic = "force-dynamic";

type BlogPageProps = Readonly<{ searchParams: Promise<Readonly<{ pagina?: string; categoria?: string }>> }>;

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" });

export async function generateMetadata({ searchParams }: BlogPageProps): Promise<Metadata> {
  const { pagina, categoria } = await searchParams;
  const filtered = Boolean(categoria) || (Number(pagina) || 1) > 1;

  return {
    title: "Blog — notícias de concursos públicos",
    description: "Editais, datas de provas, salários e dicas de estudo para concursos públicos. Atualizado pela equipe do Sou Bizurado.",
    alternates: { canonical: "/blog", types: { "application/rss+xml": "/blog/rss.xml" } },
    // Filtered / paginated lists are not indexed on their own (the posts are).
    ...(filtered ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const params = await searchParams;
  const page = Math.max(1, Math.min(10_000, Math.trunc(Number(params.pagina)) || 1));
  const categorySlug = params.categoria && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(params.categoria) ? params.categoria : null;
  const { posts, totalPages, categories } = await listLivePosts({ page, categorySlug, now: new Date() });

  const href = (changes: { pagina?: number; categoria?: string | null }) => {
    const query = new URLSearchParams();
    const category = changes.categoria === undefined ? categorySlug : changes.categoria;
    if (category) query.set("categoria", category);
    if (changes.pagina && changes.pagina > 1) query.set("pagina", String(changes.pagina));
    const text = query.toString();
    return text ? `/blog?${text}` : "/blog";
  };

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>Blog</span>
        <h1>Notícias de concursos</h1>
        <p>Editais, datas de provas, salários e estratégias de estudo — e questões para treinar logo em seguida.</p>
      </header>

      {categories.length > 0 ? (
        <nav className={styles.categories} aria-label="Categorias">
          <Link href={href({ categoria: null })} className={categorySlug ? styles.chip : styles.chipActive}>
            Todas
          </Link>
          {categories.map((category) => (
            <Link key={category.slug} href={href({ categoria: category.slug })} className={category.slug === categorySlug ? styles.chipActive : styles.chip}>
              {category.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {posts.length === 0 ? (
        <p className={styles.empty}>
          Nenhum post publicado ainda. Enquanto isso, <Link href="/questoes">resolva questões grátis</Link>.
        </p>
      ) : (
        <ul className={styles.grid}>
          {posts.map((post) => (
            <li key={post.slug} className={styles.card}>
              <Link href={`/blog/${post.slug}`} className={styles.cardLink}>
                {post.coverAssetId ? (
                  // eslint-disable-next-line @next/next/no-img-element -- protected media route
                  <img src={blogImageUrl(post.coverAssetId)} alt="" className={styles.cardCover} loading="lazy" />
                ) : (
                  <div className={styles.cardCoverEmpty} aria-hidden="true" />
                )}
                <div className={styles.cardBody}>
                  {post.category ? <span className={styles.eyebrow}>{post.category.name}</span> : null}
                  <h2>{post.title}</h2>
                  <p>{post.excerpt}</p>
                  <span className={styles.meta}>
                    {post.publishedAt ? dateFormatter.format(post.publishedAt) : ""} · {readingMinutes(post.body)} min de leitura
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <nav className={styles.pager} aria-label="Paginação">
          {page > 1 ? <Link href={href({ pagina: page - 1 })}>← Mais recentes</Link> : <span />}
          <span>
            Página {page} de {totalPages}
          </span>
          {page < totalPages ? <Link href={href({ pagina: page + 1 })}>Mais antigos →</Link> : <span />}
        </nav>
      ) : null}
    </div>
  );
}
