import Link from "next/link";

import { loadEditorials } from "@/modules/blog/infrastructure/blog-queries";

import styles from "../portal.module.css";
import { BlogIcon } from "./blog-icon";
import { NewsletterBox } from "./newsletter-box";

/** Editorials (careers and exams) + newsletter. */
export async function BlogSidebar({ activeSlug }: Readonly<{ activeSlug?: string | null }>) {
  const { careers, exams } = await loadEditorials();

  const group = (title: string, items: typeof careers) =>
    items.length > 0 ? (
      <>
        <h3>{title}</h3>
        <ul>
          {items.map((category) => (
            <li key={category.slug}>
              <Link
                href={`/blog/editoria/${category.slug}`}
                className={category.slug === activeSlug ? styles.editorialActive : styles.editorial}
                aria-current={category.slug === activeSlug ? "page" : undefined}
              >
                <BlogIcon name={category.icon} />
                {category.name}
              </Link>
            </li>
          ))}
        </ul>
      </>
    ) : null;

  return (
    <aside className={styles.sidebar}>
      <section className={styles.editorials} aria-label="Editorias">
        <h2>Editorias</h2>
        {group("Carreiras", careers)}
        {group("Exames", exams)}
      </section>
      <NewsletterBox />
    </aside>
  );
}
