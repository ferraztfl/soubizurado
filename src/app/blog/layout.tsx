import Link from "next/link";
import type { ReactNode } from "react";

import { BRAZIL_STATES } from "@/modules/blog/domain/blog";
import { loadEditorials } from "@/modules/blog/infrastructure/blog-queries";

import { SiteShell } from "../_components/site-shell";
import { BlogIcon } from "./_components/blog-icon";
import styles from "./portal.module.css";

/** News portal: the site header, then the blog's own bar (search, editorials) and the region bar. */
export default async function BlogLayout({ children }: Readonly<{ children: ReactNode }>) {
  const editorials = await loadEditorials();

  return (
    <SiteShell mainClassName={styles.blogMain}>
      <div className={styles.subbar}>
        <div className={styles.subbarInner}>
          <Link href="/blog" className={styles.subbarTitle}>
            Notícias
          </Link>
          <nav className={styles.subbarLinks} aria-label="Seções do blog">
            <Link href="/blog/noticias">Últimas</Link>
            <details className={styles.dropdown}>
              <summary>Editorias</summary>
              <div className={styles.menuPanel}>
                <div>
                  <strong>Carreiras</strong>
                  {editorials.careers.map((category) => (
                    <Link key={category.slug} href={`/blog/editoria/${category.slug}`}>
                      <BlogIcon name={category.icon} /> {category.name}
                    </Link>
                  ))}
                </div>
                <div>
                  <strong>Exames</strong>
                  {editorials.exams.map((category) => (
                    <Link key={category.slug} href={`/blog/editoria/${category.slug}`}>
                      <BlogIcon name={category.icon} /> {category.name}
                    </Link>
                  ))}
                  {editorials.general.length > 0 ? <strong>Mais</strong> : null}
                  {editorials.general.map((category) => (
                    <Link key={category.slug} href={`/blog/editoria/${category.slug}`}>
                      <BlogIcon name={category.icon} /> {category.name}
                    </Link>
                  ))}
                </div>
              </div>
            </details>
            <Link href="/blog/editoria/editais">Editais</Link>
            <Link href="/blog/artigos">Artigos</Link>
            <Link href="/concursos">Concursos</Link>
          </nav>
          <form action="/blog/busca" className={styles.search} role="search">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <label className={styles.srOnly} htmlFor="blog-search">
              Buscar no blog
            </label>
            <input id="blog-search" name="q" type="search" placeholder="Buscar notícias" maxLength={100} />
          </form>
        </div>
      </div>

      <nav className={styles.regions} aria-label="Notícias por região">
        <span className={styles.regionsLabel}>Região</span>
        <Link href="/blog/noticias" className={styles.regionNational}>
          Nacional
        </Link>
        <div className={styles.regionList}>
          {Object.entries(BRAZIL_STATES).map(([code, name]) => (
            <Link key={code} href={`/blog/regiao/${code.toLowerCase()}`} title={name}>
              {code}
            </Link>
          ))}
        </div>
      </nav>

      <div className={styles.content}>{children}</div>
    </SiteShell>
  );
}
