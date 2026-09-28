import Image from "next/image";
import Link from "next/link";

import styles from "./site-header.module.css";

const NAV = [
  { href: "/questoes", label: "Questões grátis" },
  { href: "/concursos", label: "Concursos" },
  { href: "/#materias", label: "Por matéria" },
  { href: "/#bancas", label: "Por banca" },
  { href: "/blog", label: "Notícias" },
  { href: "/blog/editoria/editais", label: "Editais" },
  { href: "/loja", label: "Planos e combos" },
] as const;

/** Public header of the home page: logo, question search, account actions and sections. */
export function SiteHeader({ signedIn }: Readonly<{ signedIn: boolean }>) {
  return (
    <header className={styles.header}>
      <div className={styles.top}>
        <Link href="/" className={styles.brand} aria-label="Sou Bizurado — início">
          <Image src="/brand/logo-horizontal.png" alt="Sou Bizurado Concursos" width={900} height={420} priority className={styles.logo} />
        </Link>

        <form action="/questoes" className={styles.search} role="search">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <label className={styles.srOnly} htmlFor="site-search">
            Buscar questões
          </label>
          <input id="site-search" name="q" type="search" placeholder="Busque questões por assunto, órgão ou palavra-chave" maxLength={120} />
        </form>

        <div className={styles.actions}>
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
                Criar conta grátis
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
            {NAV.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
            {signedIn ? null : <Link href="/login">Entrar</Link>}
          </nav>
        </details>
      </div>

      <nav className={styles.nav} aria-label="Seções">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
