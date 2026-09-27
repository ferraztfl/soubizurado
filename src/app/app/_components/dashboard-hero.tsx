import Link from "next/link";

import styles from "./dashboard-hero.module.css";

/** Daily goal of the hero card. */
export const DAILY_GOAL = 10;

export function DashboardHero({ attempts, today }: Readonly<{ attempts: number; today: number }>) {
  const done = Math.min(today, DAILY_GOAL);
  const objective =
    attempts === 0
      ? "Resolver sua primeira questão"
      : today >= DAILY_GOAL
        ? "Meta de hoje concluída!"
        : `Resolver ${DAILY_GOAL} questões hoje`;

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

          <Link href="/app/simulados" className={styles.secondaryAction}>
            Criar simulado
          </Link>
        </div>
      </div>

      <div className={styles.objectiveArea}>
        <article className={styles.objectiveCard}>
          <span className={styles.objectiveLabel}>
            Próximo objetivo
          </span>

          <strong>{objective}</strong>

          <div
            className={styles.progress}
            role="progressbar"
            aria-label="Progresso do objetivo"
            aria-valuemin={0}
            aria-valuemax={DAILY_GOAL}
            aria-valuenow={done}
          >
            <span style={{ width: `${(done / DAILY_GOAL) * 100}%` }} />
          </div>

          <small>
            {done} de {DAILY_GOAL} questões hoje
          </small>
        </article>
      </div>
    </section>
  );
}
