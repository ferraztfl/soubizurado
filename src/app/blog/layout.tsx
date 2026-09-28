import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { BRAZIL_STATES } from "@/modules/blog/domain/blog";
import { loadEditorials, loadFooterBoards } from "@/modules/blog/infrastructure/blog-queries";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";

import { BlogIcon } from "./_components/blog-icon";
import styles from "./portal.module.css";

/** News portal shell: header with search, editorial menu, region bar and a full footer. */
export default async function BlogLayout({ children }: Readonly<{ children: ReactNode }>) {
  const supabase = await createSupabaseServerClient();
  const [{ data }, editorials, boards] = await Promise.all([supabase.auth.getUser(), loadEditorials(), loadFooterBoards()]);
  const user = data.user;

  const editorialMenu = (
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
  );

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <Link href="/blog" className={styles.brand} aria-label="Blog Sou Bizurado — início">
            <Image src="/brand/logo-horizontal.png" alt="Sou Bizurado Concursos" width={900} height={420} priority className={styles.logo} />
          </Link>

          <form action="/blog/busca" className={styles.search} role="search">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <label className={styles.srOnly} htmlFor="blog-search">
              Buscar no blog
            </label>
            <input id="blog-search" name="q" type="search" placeholder="Encontre notícias, editais e artigos" maxLength={100} />
          </form>

          <div className={styles.headerActions}>
            <Link href="/questoes" className={styles.headerLink}>
              Questões grátis
            </Link>
            <Link href={user ? "/app" : "/loja"} className={styles.headerCta}>
              {user ? "Minha área" : "Assine o Premium"}
            </Link>
          </div>

          <details className={styles.mobileMenu}>
            <summary aria-label="Abrir menu">
              <span />
              <span />
              <span />
            </summary>
            <nav className={styles.mobilePanel} aria-label="Menu do blog">
              <Link href="/blog/noticias">Últimas notícias</Link>
              <Link href="/blog/artigos">Artigos</Link>
              <Link href="/questoes">Questões grátis</Link>
              <Link href="/loja">Loja</Link>
              {editorialMenu}
            </nav>
          </details>
        </div>

        <nav className={styles.nav} aria-label="Seções do blog">
          <Link href="/blog/noticias">Últimas notícias</Link>
          <details className={styles.dropdown}>
            <summary>Editorias</summary>
            {editorialMenu}
          </details>
          <Link href="/blog/artigos">Artigos</Link>
          <Link href="/blog/editoria/editais">Editais</Link>
          <Link href="/questoes">Questões</Link>
          <Link href="/loja">Loja</Link>
        </nav>
      </header>

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

      <main className={styles.content}>{children}</main>

      <footer className={styles.footer}>
        <div className={styles.footerGrid}>
          <div>
            <h2>Sou Bizurado</h2>
            <Link href="/">Página inicial</Link>
            <Link href="/questoes">Questões grátis</Link>
            <Link href="/loja">Planos e combos</Link>
            <Link href="/cadastro">Criar conta grátis</Link>
          </div>
          <div>
            <h2>Blog</h2>
            <Link href="/blog/noticias">Últimas notícias</Link>
            <Link href="/blog/artigos">Artigos e dicas</Link>
            <Link href="/blog/editoria/editais">Editais</Link>
            <Link href="/blog/rss.xml">Feed RSS</Link>
          </div>
          <div>
            <h2>Carreiras</h2>
            {editorials.careers.slice(0, 8).map((category) => (
              <Link key={category.slug} href={`/blog/editoria/${category.slug}`}>
                {category.name}
              </Link>
            ))}
          </div>
          <div>
            <h2>Questões por banca</h2>
            {boards.map((board) => (
              <Link key={board.id} href={`/questoes?board=${board.id}`}>
                {board.name}
              </Link>
            ))}
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span>© {new Date().getFullYear()} Sou Bizurado — preparação para concursos públicos</span>
          <span>
            <Link href="/termos">Termos de uso</Link> · <Link href="/privacidade">Privacidade</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
