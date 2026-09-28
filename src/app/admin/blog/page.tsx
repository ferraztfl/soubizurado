import Link from "next/link";

import { isPostVisible } from "@/modules/blog/domain/blog";
import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import styles from "../loja/loja.module.css";

export const dynamic = "force-dynamic";

type BlogAdminPageProps = Readonly<{ searchParams: Promise<Readonly<{ ok?: string; error?: string }>> }>;

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function BlogAdminPage(props: BlogAdminPageProps) {
  await requireAdminUser();

  const params = await props.searchParams;
  const now = new Date();
  const posts = await getPrismaClient().blogPost.findMany({
    orderBy: [{ publishedAt: { sort: "desc", nulls: "first" } }, { updatedAt: "desc" }],
    take: 100,
    select: { id: true, title: true, slug: true, status: true, publishedAt: true, updatedAt: true, category: { select: { name: true } } },
  });

  return (
    <main className={styles.page}>
      <header>
        <p className={styles.eyebrow}>Conteúdo</p>
        <h1 className={styles.title}>Blog</h1>
        <p className={styles.description}>
          Notícias e guias de concursos para trazer tráfego do Google. Cada post pode chamar para uma oferta da Loja e
          para as questões da banca.
        </p>
      </header>

      {params.ok === "excluido" ? <p className={styles.info}>Post excluído.</p> : null}
      {params.error ? <p className={styles.error}>{params.error.slice(0, 300)}</p> : null}

      <div>
        <Link href="/admin/blog/novo" className={styles.primary} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
          Novo post
        </Link>
      </div>

      <section className={styles.card}>
        <h2>Posts</h2>
        {posts.length === 0 ? (
          <p className={styles.hint}>Nenhum post ainda.</p>
        ) : (
          <ul className={styles.list}>
            {posts.map((post) => {
              const live = isPostVisible(post.status, post.publishedAt, now);
              const scheduled = post.status === "PUBLISHED" && !live;
              return (
                <li key={post.id}>
                  <div>
                    <strong>{post.title}</strong>
                    <span>
                      {post.category?.name ?? "Sem categoria"} ·{" "}
                      {post.publishedAt ? `${scheduled ? "agendado para" : "publicado em"} ${dateFormatter.format(post.publishedAt)}` : `editado em ${dateFormatter.format(post.updatedAt)}`}
                    </span>
                  </div>
                  <div className={styles.row}>
                    <span className={live ? styles.badgeOn : styles.badgeOff}>{live ? "No ar" : scheduled ? "Agendado" : "Rascunho"}</span>
                    {live ? <Link href={`/blog/${post.slug}`}>Ver</Link> : null}
                    <Link href={`/admin/blog/${post.id}`}>Editar</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
