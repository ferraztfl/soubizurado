import { MetricCard } from "@/shared/ui/metric-card";

import styles from "./dashboard-metrics.module.css";

export type DashboardMetricsData = Readonly<{
  attempts: number;
  correct: number;
  streakDays: number;
  favorites: number;
}>;

const numberFormatter = new Intl.NumberFormat("pt-BR");

/** The student's headline numbers (all zero before the first answer). */
export function DashboardMetrics({ data }: Readonly<{ data: DashboardMetricsData }>) {
  const rate = data.attempts === 0 ? 0 : Math.round((data.correct / data.attempts) * 100);

  const metrics = [
    {
      label: "Questões resolvidas",
      value: numberFormatter.format(data.attempts),
      detail: data.attempts === 0 ? "Comece seu primeiro treino" : "Respostas enviadas até agora",
      accent: "brand" as const,
    },
    {
      label: "Taxa de acertos",
      value: `${rate}%`,
      detail: data.attempts === 0 ? "Seu desempenho aparecerá aqui" : `${numberFormatter.format(data.correct)} acertos`,
      accent: "success" as const,
    },
    {
      label: "Sequência de estudos",
      value: `${data.streakDays} ${data.streakDays === 1 ? "dia" : "dias"}`,
      detail: data.streakDays === 0 ? "Estude hoje para começar" : "Dias seguidos com respostas",
      accent: "warning" as const,
    },
    {
      label: "Questões favoritas",
      value: numberFormatter.format(data.favorites),
      detail: data.favorites === 0 ? "Salve questões importantes" : "Salvas para revisar",
      accent: "info" as const,
    },
  ];

  return (
    <section className={styles.grid} aria-label="Resumo de desempenho">
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
