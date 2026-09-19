import { MetricCard } from "@/shared/ui/metric-card";

import styles from "./dashboard-metrics.module.css";

const metrics = [
  {
    label: "Questões resolvidas",
    value: "0",
    detail: "Comece seu primeiro treino",
    accent: "brand" as const,
  },
  {
    label: "Taxa de acertos",
    value: "0%",
    detail: "Seu desempenho aparecerá aqui",
    accent: "success" as const,
  },
  {
    label: "Sequência de estudos",
    value: "0 dias",
    detail: "Estude hoje para começar",
    accent: "warning" as const,
  },
  {
    label: "Questões favoritas",
    value: "0",
    detail: "Salve questões importantes",
    accent: "info" as const,
  },
] as const;

export function DashboardMetrics() {
  return (
    <section
      className={styles.grid}
      aria-label="Resumo de desempenho"
    >
      {metrics.map((metric) => (
        <MetricCard
          key={metric.label}
          label={metric.label}
          value={metric.value}
          detail={metric.detail}
          accent={metric.accent}
        />
      ))}
    </section>
  );
}
