import Link from "next/link";

import { buildQuestionExplorerHref } from "@/modules/question-bank/presentation/question-explorer-search-params";
import { findStudentProfileId } from "@/modules/study/infrastructure/queries/answered-question-status";
import {
  loadStudentPerformance,
  WEAK_TOPIC_MIN_ATTEMPTS,
  weakestTopics,
  type PerformanceCounts,
} from "@/modules/study/infrastructure/queries/student-performance";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";
import { EmptyState } from "@/shared/ui/empty-state";
import { PageHeader } from "@/shared/ui/page-header";

import styles from "./desempenho.module.css";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("pt-BR");
const weekFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

function rate(counts: PerformanceCounts): number {
  return counts.attempts === 0 ? 0 : Math.round((counts.correct / counts.attempts) * 100);
}

function rateTone(value: number): string {
  if (value >= 70) return styles.good!;
  if (value >= 50) return styles.fair!;
  return styles.poor!;
}

export default async function PerformancePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profileId = user ? await findStudentProfileId(user.id) : null;
  const performance = profileId ? await loadStudentPerformance(profileId) : null;

  const header = (
    <PageHeader
      eyebrow="Evolução"
      title="Desempenho"
      description="Seu ritmo e seus acertos por matéria e por tópico. Use os atalhos para praticar onde você mais precisa."
    />
  );

  if (!performance || performance.totals.attempts === 0) {
    return (
      <div className={styles.page}>
        {header}
        <div className={styles.card}>
          <EmptyState
            icon="📈"
            title="Seu desempenho aparece aqui"
            description="Resolva algumas questões no explorador e volte para ver sua taxa de acerto, sua evolução e seus pontos de atenção."
          />
          <div className={styles.emptyAction}>
            <Link href="/app/questoes" className={styles.primaryLink}>
              Explorar questões
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { totals, weeks, disciplines } = performance;
  const weak = weakestTopics(performance.topics);
  const busiestWeek = Math.max(1, ...weeks.map((week) => week.attempts));
  const totalRate = rate(totals);

  return (
    <div className={styles.page}>
      {header}

      <section className={styles.kpis} aria-label="Resumo">
        <div className={styles.kpi}>
          <span>Respostas</span>
          <strong>{numberFormatter.format(totals.attempts)}</strong>
          <small>{numberFormatter.format(totals.distinctQuestions)} questões diferentes</small>
        </div>
        <div className={styles.kpi}>
          <span>Taxa de acerto</span>
          <strong className={rateTone(totalRate)}>{totalRate}%</strong>
          <small>
            {numberFormatter.format(totals.correct)} acertos de {numberFormatter.format(totals.attempts)}
          </small>
        </div>
        <div className={styles.kpi}>
          <span>Nesta semana</span>
          <strong>{numberFormatter.format(totals.thisWeek)}</strong>
          <small>respostas desde segunda-feira</small>
        </div>
        <div className={styles.kpi}>
          <span>Sequência</span>
          <strong>
            {totals.streakDays} {totals.streakDays === 1 ? "dia" : "dias"}
          </strong>
          <small>
            {totals.averageResponseSeconds !== null
              ? `~${totals.averageResponseSeconds}s por questão`
              : "estudando em dias seguidos"}
          </small>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="weeks-title">
        <div className={styles.cardHead}>
          <h2 id="weeks-title">Evolução semanal</h2>
          <p>Respostas por semana nas últimas {weeks.length} semanas.</p>
          <ul className={styles.legend} aria-label="Legenda">
            <li>
              <span className={styles.legendCorrect} aria-hidden="true" /> Acertos
            </li>
            <li>
              <span className={styles.legendWrong} aria-hidden="true" /> Erros
            </li>
          </ul>
        </div>
        <ol className={styles.chart}>
          {weeks.map((week) => (
            <li key={week.weekStart} className={styles.bar}>
              <span
                className={styles.barTrack}
                title={`Semana de ${weekFormatter.format(new Date(`${week.weekStart}T00:00:00Z`))}: ${week.attempts} respostas, ${week.correct} acertos`}
              >
                <span className={styles.barTotal} style={{ height: `${(week.attempts / busiestWeek) * 100}%` }}>
                  <span
                    className={styles.barCorrect}
                    style={{ height: `${week.attempts === 0 ? 0 : (week.correct / week.attempts) * 100}%` }}
                  />
                </span>
              </span>
              <span className={styles.barValue}>{week.attempts ? `${week.correct}/${week.attempts}` : ""}</span>
              <span className={styles.barLabel}>{weekFormatter.format(new Date(`${week.weekStart}T00:00:00Z`))}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className={styles.columns}>
        <section className={styles.card} aria-labelledby="disciplines-title">
          <div className={styles.cardHead}>
            <h2 id="disciplines-title">Por matéria</h2>
            <p>Taxa de acerto em cada matéria que você já praticou.</p>
          </div>
          <ul className={styles.rows}>
            {disciplines.map((discipline) => {
              const value = rate(discipline);

              return (
                <li key={discipline.disciplineId} className={styles.row}>
                  <div className={styles.rowHead}>
                    <strong>{discipline.name}</strong>
                    <span className={rateTone(value)}>{value}%</span>
                  </div>
                  <span className={styles.meter} aria-hidden="true">
                    <span className={rateTone(value)} style={{ width: `${Math.max(value, 2)}%` }} />
                  </span>
                  <div className={styles.rowFoot}>
                    <span>
                      {discipline.correct}/{discipline.attempts} acertos
                    </span>
                    <Link
                      href={buildQuestionExplorerHref({
                        disciplineId: discipline.disciplineId,
                        situation: "nao-resolvidas",
                      })}
                    >
                      Praticar novas
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className={styles.card} aria-labelledby="weak-title">
          <div className={styles.cardHead}>
            <h2 id="weak-title">Pontos de atenção</h2>
            <p>Tópicos com menor acerto (a partir de {WEAK_TOPIC_MIN_ATTEMPTS} respostas).</p>
          </div>
          {weak.length === 0 ? (
            <p className={styles.muted}>
              Nenhum ponto fraco por enquanto. Continue resolvendo: com mais respostas por tópico, esta lista mostra onde
              revisar.
            </p>
          ) : (
            <ul className={styles.rows}>
              {weak.map((topic) => {
                const value = rate(topic);

                return (
                  <li key={topic.areaId} className={styles.row}>
                    <div className={styles.rowHead}>
                      <strong>
                        {topic.name}
                        <small>{topic.disciplineName}</small>
                      </strong>
                      <span className={rateTone(value)}>{value}%</span>
                    </div>
                    <div className={styles.rowFoot}>
                      <span>
                        {topic.correct}/{topic.attempts} acertos
                      </span>
                      <Link
                        href={buildQuestionExplorerHref({
                          disciplineId: topic.disciplineId,
                          areaId: topic.areaId,
                          situation: "erradas",
                        })}
                      >
                        Refazer as erradas
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
