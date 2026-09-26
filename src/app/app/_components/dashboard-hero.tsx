import Link from "next/link";

import styles from "./dashboard-hero.module.css";

export function DashboardHero() {
  return (
    <section className={styles.hero}>
      <div className={styles.content}>
        <span className={styles.eyebrow}>
          Painel de estudos
        </span>

        <h1>
          Sua aprovação começa com uma questão.
        </h1>

        <p>
          Acompanhe sua evolução, resolva questões
          e concentre seus estudos nos assuntos
          que mais precisam de atenção.
        </p>

        <div className={styles.actions}>
          <Link
            href="/app/questoes"
            className={styles.primaryAction}
          >
            Resolver questões
          </Link>

          <button
            type="button"
            className={styles.secondaryAction}
            disabled
          >
            Criar simulado
          </button>
        </div>
      </div>

      <div className={styles.objectiveArea}>
        <article className={styles.objectiveCard}>
          <span className={styles.objectiveLabel}>
            Próximo objetivo
          </span>

          <strong>
            Resolver sua primeira questão
          </strong>

          <div
            className={styles.progress}
            role="progressbar"
            aria-label="Progresso do objetivo"
            aria-valuemin={0}
            aria-valuemax={10}
            aria-valuenow={0}
          >
            <span />
          </div>

          <small>0 de 10 questões</small>
        </article>
      </div>
    </section>
  );
}
