import { EmptyState } from "@/shared/ui/empty-state";

import styles from "./performance-card.module.css";

const placeholderBars = [
  24,
  38,
  29,
  52,
  44,
  64,
  76,
] as const;

export function PerformanceCard() {
  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>
            Desempenho
          </span>

          <h2>
            Evolução dos seus estudos
          </h2>
        </div>

        <span className={styles.period}>
          Últimos 7 dias
        </span>
      </header>

      <div className={styles.chart}>
        <div
          className={styles.bars}
          aria-hidden="true"
        >
          {placeholderBars.map((height, index) => (
            <span
              key={`${height}-${index}`}
              style={{
                height: `${height}%`,
              }}
            />
          ))}
        </div>

        <div className={styles.emptyState}>
          <EmptyState
            icon="↗"
            title="Seus dados aparecerão aqui"
            description="Resolva questões para começar a acompanhar sua evolução, precisão e ritmo de estudo."
          />
        </div>
      </div>
    </article>
  );
}
