import Link from "next/link";

import { loadEditorials, loadFooterBoards } from "@/modules/blog/infrastructure/blog-queries";

import styles from "./site-footer.module.css";

/** Public footer shared by the home page and the blog. */
export async function SiteFooter() {
  const [editorials, boards] = await Promise.all([loadEditorials(), loadFooterBoards()]);

  return (
    <footer className={styles.footer}>
      <div className={styles.grid}>
        <div>
          <h2>Sou Bizurado</h2>
          <Link href="/">Página inicial</Link>
          <Link href="/questoes">Questões grátis</Link>
          <Link href="/loja">Planos e combos</Link>
          <Link href="/cadastro">Criar conta grátis</Link>
          <Link href="/login">Entrar</Link>
        </div>
        <div>
          <h2>Blog</h2>
          <Link href="/blog">Notícias de concursos</Link>
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
      <div className={styles.bottom}>
        <span>© {new Date().getFullYear()} Sou Bizurado — preparação para concursos públicos</span>
        <span>
          <Link href="/termos">Termos de uso</Link> · <Link href="/privacidade">Privacidade</Link>
        </span>
      </div>
    </footer>
  );
}
