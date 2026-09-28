import Link from "next/link";
import { notFound } from "next/navigation";

import { isPostVisible, toSaoPauloInput } from "@/modules/blog/domain/blog";
import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import styles from "../../loja/loja.module.css";
import { deletePostAction } from "../actions";
import { loadPostFormOptions } from "../load-post-form-options";
import { PostForm } from "../post-form";

export const dynamic = "force-dynamic";

type EditPostPageProps = Readonly<{
  params: Promise<{ postId: string }>;
  searchParams: Promise<Readonly<{ ok?: string; error?: string }>>;
}>;

export default async function EditPostPage(props: EditPostPageProps) {
  await requireAdminUser();

  const { postId } = await props.params;
  const params = await props.searchParams;
  const [post, options] = await Promise.all([
    /^[0-9a-f-]{36}$/i.test(postId)
      ? getPrismaClient().blogPost.findUnique({
          where: { id: postId },
          include: { category: { select: { name: true } }, _count: { select: { images: true } } },
        })
      : null,
    loadPostFormOptions(),
  ]);

  if (!post) {
    notFound();
  }

  const live = isPostVisible(post.status, post.publishedAt, new Date());

  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb}>
        <Link href="/admin/blog">Blog</Link> / <span>{post.title}</span>
      </nav>
      <h1 className={styles.title}>Editar post</h1>
      {params.ok ? <p className={styles.info}>Post salvo.</p> : null}
      {params.error ? <p className={styles.error}>{params.error.slice(0, 300)}</p> : null}
      <p className={styles.hint}>
        {live ? (
          <>
            No ar em <Link href={`/blog/${post.slug}`}>/blog/{post.slug}</Link>
          </>
        ) : (
          "Ainda não está no ar (rascunho ou agendado)."
        )}
      </p>

      <section className={styles.card}>
        <PostForm
          values={{
            id: post.id,
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt,
            body: post.body,
            status: post.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
            publishAt: toSaoPauloInput(post.publishedAt),
            category: post.category?.name ?? "",
            relatedOfferId: post.relatedOfferId,
            relatedBoardId: post.relatedBoardId,
            contestId: post.contestId,
            hasCover: post.coverAssetId !== null,
            imageCount: post._count.images,
            format: post.format === "ARTICLE" ? "ARTICLE" : "NEWS",
            stateCode: post.stateCode,
            isFeatured: post.isFeatured,
          }}
          {...options}
        />
      </section>

      <section className={styles.card}>
        <h2>Excluir post</h2>
        <form action={deletePostAction} className={styles.checks}>
          <input type="hidden" name="postId" value={post.id} />
          <label>
            <input type="checkbox" name="confirm" /> Confirmo a exclusão (para tirar do ar sem excluir, volte para Rascunho)
          </label>
          <button type="submit" className={styles.secondary}>
            Excluir
          </button>
        </form>
      </section>
    </main>
  );
}
