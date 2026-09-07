import Image from "next/image";
import Link from "next/link";

import styles from "./home.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Image
          src="/brand/logo-horizontal.png"
          alt="Sou Bizurado Concursos"
          width={900}
          height={420}
          priority
          className={styles.logo}
        />

        <nav className={styles.actions}>
          <Link
            href="/login"
            className={styles.secondary}
          >
            Entrar
          </Link>

          <Link
            href="/cadastro"
            className={styles.primary}
          >
            Criar conta
          </Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.copy}>
          <span className={styles.eyebrow}>
            Preparação para concursos públicos
          </span>

          <h1>
            Mais prática.
            <br />
            Mais clareza.
            <br />
            Mais evolução.
          </h1>

          <p>
            Resolva questões, acompanhe seu desempenho
            e organize sua preparação em um só lugar.
          </p>

          <div className={styles.cta}>
            <Link
              href="/cadastro"
              className={styles.primaryLarge}
            >
              Começar gratuitamente
            </Link>

            <Link
              href="/login"
              className={styles.textLink}
            >
              Já tenho uma conta
            </Link>
          </div>
        </div>

        <div className={styles.visual}>
          <div className={styles.visualCard}>
            <span>Seu próximo passo</span>
            <strong>
              Transformar estudo em desempenho.
            </strong>
            <div className={styles.line} />
            <small>
              Banco de questões • simulados • métricas
            </small>
          </div>
        </div>
      </section>
    </main>
  );
}
