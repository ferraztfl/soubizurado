import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./auth-shell.module.css";

type AuthLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function AuthLayout({
  children,
}: AuthLayoutProps) {
  return (
    <main className={styles.page}>
      <section className={styles.brandPanel}>
        <div className={styles.brandContent}>
          <Link
            href="/"
            className={styles.logoPlate}
            aria-label="Sou Bizurado Concursos"
          >
            <Image
              src="/brand/logo-horizontal.png"
              alt="Sou Bizurado Concursos"
              width={900}
              height={420}
              priority
              className={styles.logo}
            />
          </Link>

          <div className={styles.hero}>
            <span className={styles.eyebrow}>
              Preparação com estratégia
            </span>

            <h1>
              Estude com foco.
              <br />
              Evolua com dados.
            </h1>

            <p>
              Questões, simulados e acompanhamento
              de desempenho para transformar rotina
              em progresso mensurável.
            </p>
          </div>

          <div className={styles.features}>
            <div>
              <strong>Questões direcionadas</strong>
              <span>
                Filtre por disciplina, assunto,
                banca e concurso.
              </span>
            </div>

            <div>
              <strong>Evolução visível</strong>
              <span>
                Acompanhe acertos, erros e consistência.
              </span>
            </div>

            <div>
              <strong>Estudo objetivo</strong>
              <span>
                Menos distração. Mais prática relevante.
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.formPanel}>
        <Link
          href="/"
          className={styles.mobileLogo}
          aria-label="Sou Bizurado Concursos"
        >
          <Image
            src="/brand/logo-horizontal.png"
            alt="Sou Bizurado Concursos"
            width={900}
            height={420}
            priority
          />
        </Link>

        <div className={styles.formContainer}>
          {children}
        </div>

        <p className={styles.copyright}>
          © 2026 Sou Bizurado
        </p>
      </section>
    </main>
  );
}
