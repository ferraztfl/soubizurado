import styles from "./metric-card.module.css";

type MetricCardProps = Readonly<{
  label: string;
  value: string;
  detail?: string;
  accent?: "brand" | "success" | "warning" | "info";
}>;

export function MetricCard({
  label,
  value,
  detail,
  accent = "brand",
}: MetricCardProps) {
  return (
    <article
      className={styles.card}
      data-accent={accent}
    >
      <div className={styles.heading}>
        <span className={styles.indicator} />
        <span className={styles.label}>
          {label}
        </span>
      </div>

      <strong>{value}</strong>

      {detail ? (
        <span className={styles.detail}>
          {detail}
        </span>
      ) : null}
    </article>
  );
}
