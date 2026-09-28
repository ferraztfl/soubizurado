import Link from "next/link";

import { requireAdminUser } from "@/modules/identity/application/require-admin-user";

import styles from "../../loja/loja.module.css";
import { loadPostFormOptions } from "../load-post-form-options";
import { PostForm } from "../post-form";

export const dynamic = "force-dynamic";

type NewPostPageProps = Readonly<{ searchParams: Promise<Readonly<{ error?: string }>> }>;

export default async function NewPostPage(props: NewPostPageProps) {
  await requireAdminUser();

  const params = await props.searchParams;
  const options = await loadPostFormOptions();

  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb}>
        <Link href="/admin/blog">Blog</Link> / <span>Novo post</span>
      </nav>
      <h1 className={styles.title}>Novo post</h1>
      {params.error ? <p className={styles.error}>{params.error.slice(0, 300)}</p> : null}
      <section className={styles.card}>
        <PostForm
          values={{
            id: null,
            title: "",
            slug: "",
            excerpt: "",
            body: "",
            status: "DRAFT",
            publishAt: "",
            category: "",
            relatedOfferId: null,
            relatedBoardId: null,
            hasCover: false,
            imageCount: 0,
          }}
          {...options}
        />
      </section>
    </main>
  );
}
