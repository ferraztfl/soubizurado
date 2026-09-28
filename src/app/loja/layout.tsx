import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";

import styles from "./loja.module.css";

/** Public store shell: brand, links and the account entry point. */
export default async function StoreLayout({ children }: Readonly<{ children: ReactNode }>) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="Sou Bizurado — página inicial">
          <Image src="/brand/logo-horizontal.png" alt="Sou Bizurado Concursos" width={900} height={420} className={styles.logo} priority />
        </Link>
        <nav className={styles.nav} aria-label="Navegação">
          <Link href="/questoes">Questões grátis</Link>
          <Link href="/blog">Blog</Link>
          <Link href="/loja">Loja</Link>
          {user ? (
            <Link href="/app" className={styles.navPrimary}>
              Minha área
            </Link>
          ) : (
            <>
              <Link href="/login">Entrar</Link>
              <Link href="/cadastro" className={styles.navPrimary}>
                Criar conta
              </Link>
            </>
          )}
        </nav>
      </header>
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        <span>© {new Date().getFullYear()} Sou Bizurado</span>
        <Link href="/termos">Termos de uso</Link>
        <Link href="/privacidade">Privacidade</Link>
      </footer>
    </div>
  );
}
