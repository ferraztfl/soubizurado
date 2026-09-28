import Image from "next/image";
import Link from "next/link";

import styles from "./site-header.module.css";

type NavLink = Readonly<{ href: string; label: string; hint?: string }>;
type NavItem = Readonly<{ label: string; href: string; children?: readonly NavLink[]; highlight?: boolean }>;

const NAV: readonly NavItem[] = [
  { label: "Início", href: "/" },
  {
    label: "Questões",
    href: "/questoes",
    children: [
      { href: "/questoes", label: "Banco de questões", hint: "Filtre por matéria, banca, órgão e ano" },
      { href: "/#materias", label: "Por matéria", hint: "As matérias com mais questões" },
      { href: "/#bancas", label: "Por banca", hint: "CEBRASPE, FGV, AOCP e outras" },
      { href: "/app/estudar", label: "Estudar e revisar", hint: "Sessões guiadas e revisão dos erros" },
      { href: "/app/simulados", label: "Simulados", hint: "Treine no tempo da prova" },
    ],
  },
  { label: "Concursos", href: "/concursos" },
  {
    label: "Notícias",
    href: "/blog",
    children: [
      { href: "/blog", label: "Portal de notícias", hint: "O que acontece nos concursos" },
      { href: "/blog/noticias", label: "Últimas notícias" },
      { href: "/blog/editoria/editais", label: "Editais" },
      { href: "/blog/artigos", label: "Artigos e dicas de estudo" },
    ],
  },
  { label: "Combos", href: "/loja" },
  { label: "Assinatura", href: "/assinatura", highlight: true },
];

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Public header shared by every public page (home, blog, concursos, loja, assinatura). */
export function SiteHeader({ signedIn, premium = false }: Readonly<{ signedIn: boolean; premium?: boolean }>) {
  return (
    <header className={styles.header}>
      <div className={styles.bar}>
        <Link href="/" className={styles.brand} aria-label="Sou Bizurado — início">
          <Image src="/brand/logo-horizontal.png" alt="Sou Bizurado Concursos" width={900} height={420} priority className={styles.logo} />
        </Link>

        <nav className={styles.nav} aria-label="Principal">
          {NAV.map((item) =>
            item.children ? (
              <details key={item.label} className={styles.dropdown}>
                <summary>{item.label}</summary>
                <div className={styles.panel}>
                  {item.children.map((child) => (
                    <Link key={child.href + child.label} href={child.href}>
                      <strong>{child.label}</strong>
                      {child.hint ? <span>{child.hint}</span> : null}
                    </Link>
                  ))}
                </div>
              </details>
            ) : (
              <Link key={item.label} href={item.href} className={item.highlight ? styles.highlight : undefined}>
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className={styles.actions}>
          <details className={styles.searchToggle}>
            <summary aria-label="Buscar questões">
              <SearchIcon />
            </summary>
            <form action="/questoes" className={styles.searchPanel} role="search">
              <label className={styles.srOnly} htmlFor="site-search">
                Buscar questões
              </label>
              <input id="site-search" name="q" type="search" placeholder="Busque questões por assunto ou palavra-chave" maxLength={120} />
              <button type="submit">Buscar</button>
            </form>
          </details>

          {premium ? null : (
            <Link href="/assinatura" className={styles.premium}>
              ★ Assinar Premium
            </Link>
          )}
          {signedIn ? (
            <Link href="/app" className={styles.cta}>
              Minha área
            </Link>
          ) : (
            <>
              <Link href="/login" className={styles.login}>
                Entrar
              </Link>
              <Link href="/cadastro" className={styles.cta}>
                Criar conta
              </Link>
            </>
          )}
        </div>

        <details className={styles.mobileMenu}>
          <summary aria-label="Abrir menu">
            <span />
            <span />
            <span />
          </summary>
          <nav className={styles.mobilePanel} aria-label="Menu">
            <form action="/questoes" className={styles.mobileSearch} role="search">
              <label className={styles.srOnly} htmlFor="mobile-search">
                Buscar questões
              </label>
              <input id="mobile-search" name="q" type="search" placeholder="Buscar questões" maxLength={120} />
            </form>
            {NAV.map((item) =>
              item.children ? (
                <div key={item.label} className={styles.mobileGroup}>
                  <strong>{item.label}</strong>
                  {item.children.map((child) => (
                    <Link key={child.href + child.label} href={child.href}>
                      {child.label}
                    </Link>
                  ))}
                </div>
              ) : (
                <Link key={item.label} href={item.href} className={styles.mobileLink}>
                  {item.label}
                </Link>
              ),
            )}
            {signedIn ? (
              <Link href="/app" className={styles.mobileLink}>
                Minha área
              </Link>
            ) : (
              <>
                <Link href="/login" className={styles.mobileLink}>
                  Entrar
                </Link>
                <Link href="/cadastro" className={styles.mobileLink}>
                  Criar conta grátis
                </Link>
              </>
            )}
          </nav>
        </details>
      </div>
    </header>
  );
}
