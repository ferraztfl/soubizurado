import Link from "next/link";

import styles from "./continue-studying-card.module.css";

export function ContinueStudyingCard() {
  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>
            Continue estudando
          </span>

          <h2>Sua próxima sessão começa aqui</h2>
        </div>

        <span className={styles.status}>
          Ainda não iniciado
        </span>
      </header>

      <div className={styles.body}>
        <div className={styles.icon} aria-hidden="true">
          Q
        </div>

        <div className={styles.copy}>
          <strong>Escolha uma disciplina para começar</strong>
          <p>
            Quando você iniciar seus estudos, o Sou Bizurado vai manter aqui
            seu último contexto para você continuar sem perder o ritmo.
          </p>
        </div>

        <Link
          href="/app/questoes"
          className={styles.action}
        >
          Explorar questões
        </Link>
      </div>
    </article>
  );
}
