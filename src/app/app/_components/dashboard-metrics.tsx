import styles from "./dashboard-metrics.module.css";

const metrics = [
  {
    label: "Questões resolvidas",
    value: "0",
    detail: "Comece seu primeiro treino",
  },
  {
    label: "Taxa de acertos",
    value: "0%",
    detail: "Seu desempenho aparecerá aqui",
  },
  {
    label: "Sequência de estudos",
    value: "0 dias",
    detail: "Estude hoje para começar",
  },
  {
    label: "Questões favoritas",
    value: "0",
    detail: "Salve questões importantes",
  },
] as const;

export function DashboardMetrics() {
  return (
    <section
      className={styles.grid}
      aria-label="Resumo de desempenho"
    >
      {metrics.map((metric) => (
        <article
          key={metric.label}
          className={styles.card}
        >
          <span className={styles.label}>
            {metric.label}
          </span>

          <strong>{metric.value}</strong>

          <span className={styles.detail}>
            {metric.detail}
          </span>
        </article>
      ))}
    </section>
  );
}
