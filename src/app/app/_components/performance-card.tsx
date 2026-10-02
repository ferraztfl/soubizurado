import Link from "next/link";

import type { DayPerformance } from "@/modules/study/infrastructure/queries/student-performance";
import { EmptyState } from "@/shared/ui/empty-state";

import styles from "./performance-card.module.css";

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

/** "2026-10-01" → "qua" (the day is already a São Paulo calendar day). */
function weekdayOf(day: string): string {
  return WEEKDAYS[new Date(`${day}T12:00:00Z`).getUTCDay()]!;
}

/**
 * Answers per day over the last 7 days (right in green, wrong in red) with the
 * week's totals. Before the first answer it explains what will appear.
 */
export function PerformanceCard({ attempts, days }: Readonly<{ attempts: number; days: readonly DayPerformance[] }>) {
  const weekAttempts = days.reduce((sum, day) => sum + day.attempts, 0);
  const weekCorrect = days.reduce((sum, day) => sum + day.correct, 0);
  const peak = Math.max(1, ...days.map((day) => day.attempts));
  const today = days[days.length - 1]?.day;

  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Desempenho</span>
          <h2>Evolução dos seus estudos</h2>
        </div>

        <span className={styles.period}>Últimos 7 dias</span>
      </header>

      {attempts === 0 ? (
        <EmptyState icon="↗" title="Seus dados aparecerão aqui" description="Resolva questões para começar a acompanhar sua evolução, precisão e ritmo de estudo." />
      ) : (
        <>
          <dl className={styles.summary}>
            <div>
              <dt>Respondidas na semana</dt>
              <dd>{weekAttempts}</dd>
            </div>
            <div>
              <dt>Taxa de acerto da semana</dt>
              <dd>{weekAttempts > 0 ? `${Math.round((weekCorrect / weekAttempts) * 100)}%` : "—"}</dd>
            </div>
            <div>
              <dt>Total desde o início</dt>
              <dd>{attempts}</dd>
            </div>
          </dl>

          <div className={styles.dayChart} role="img" aria-label={`Questões respondidas por dia: ${days.map((day) => `${weekdayOf(day.day)} ${day.attempts}`).join(", ")}`}>
            {days.map((day) => (
              <div key={day.day} className={styles.dayColumn} title={`${day.day.slice(8)}/${day.day.slice(5, 7)}: ${day.correct} certas e ${day.attempts - day.correct} erradas`}>
                <span className={styles.dayTotal}>{day.attempts > 0 ? day.attempts : ""}</span>
                <div className={styles.dayTrack}>
                  <div className={styles.dayStack} style={{ height: `${(day.attempts / peak) * 100}%` }}>
                    <span className={styles.dayWrong} style={{ flexGrow: day.attempts - day.correct }} />
                    <span className={styles.dayRight} style={{ flexGrow: day.correct }} />
                  </div>
                </div>
                <span className={day.day === today ? styles.dayLabelToday : styles.dayLabel}>{day.day === today ? "hoje" : weekdayOf(day.day)}</span>
              </div>
            ))}
          </div>

          <div className={styles.legend}>
            <span>
              <i className={styles.dotRight} /> Certas
            </span>
            <span>
              <i className={styles.dotWrong} /> Erradas
            </span>
            <Link href="/app/desempenho" className={styles.cta}>
              Ver meu desempenho completo
            </Link>
          </div>
        </>
      )}
    </article>
  );
}
