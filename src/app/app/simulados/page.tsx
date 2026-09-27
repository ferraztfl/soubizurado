import Link from "next/link";

import { createListQuestionExplorerFacetsUseCase } from "@/modules/question-bank/infrastructure/composition/question-bank-application";
import { formatDuration, SIMULATION_QUESTION_COUNTS, SIMULATION_TIME_LIMITS } from "@/modules/study/domain/simulation";
import { findStudentProfileId } from "@/modules/study/infrastructure/queries/answered-question-status";
import { listSimulations } from "@/modules/study/infrastructure/simulations/simulation-store";
import { createSimulationAction } from "@/modules/study/presentation/actions/simulation-actions";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";
import { PageHeader } from "@/shared/ui/page-header";

import { SubmitButton } from "./_components/submit-button";
import styles from "./simulados.module.css";

export const dynamic = "force-dynamic";

type SimulationsPageProps = Readonly<{
  searchParams: Promise<Readonly<{ erro?: string }>>;
}>;

const ERRORS: Record<string, string> = {
  "sem-questoes": "Nenhuma questão publicada atende a esses filtros. Afrouxe algum filtro e tente de novo.",
  dados: "Confira a quantidade de questões e o tempo escolhidos.",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

export default async function SimulationsPage({ searchParams }: SimulationsPageProps) {
  const { erro } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profileId = user ? await findStudentProfileId(user.id) : null;

  const [facets, simulations] = await Promise.all([
    createListQuestionExplorerFacetsUseCase().execute(),
    profileId ? listSimulations(profileId) : Promise.resolve([]),
  ]);

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Evolução"
        title="Simulados"
        description="Monte uma prova com as questões do banco, resolva no seu tempo ou com cronômetro e veja o resultado por matéria no final."
      />

      {erro && ERRORS[erro] ? (
        <p className={styles.error} role="alert">
          {ERRORS[erro]}
        </p>
      ) : null}

      <section className={styles.card} aria-labelledby="create-title">
        <div className={styles.cardHead}>
          <h2 id="create-title">Novo simulado</h2>
          <p>As questões são sorteadas entre as publicadas que atendem aos filtros. O gabarito só aparece no final.</p>
        </div>

        <form action={createSimulationAction} className={styles.form}>
          <label className={`${styles.field} ${styles.wide}`}>
            <span>Nome (opcional)</span>
            <input name="title" maxLength={160} placeholder="Ex.: Revisão de Direito Constitucional" />
          </label>

          <label className={styles.field}>
            <span>Matéria</span>
            <select name="discipline" defaultValue="">
              <option value="">Todas as matérias</option>
              {facets.disciplines.map((discipline) => (
                <option key={discipline.id} value={discipline.id}>
                  {discipline.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Banca</span>
            <select name="board" defaultValue="">
              <option value="">Todas as bancas</option>
              {facets.boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.acronym && board.acronym !== board.name ? `${board.acronym} — ${board.name}` : board.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Ano</span>
            <select name="year" defaultValue="">
              <option value="">Todos os anos</option>
              {facets.years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Tipo</span>
            <select name="type" defaultValue="">
              <option value="">Todos os tipos</option>
              {facets.types.map((type) => (
                <option key={type} value={type}>
                  {type === "MULTIPLE_CHOICE" ? "Múltipla escolha" : "Certo / Errado"}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Questões</span>
            <select name="situacao" defaultValue="">
              <option value="">Qualquer questão</option>
              <option value="nao-resolvidas">Só as que nunca resolvi</option>
              <option value="erradas">Só as que já errei</option>
              <option value="favoritas">Só as favoritas</option>
            </select>
          </label>

          <label className={styles.field}>
            <span>Quantidade</span>
            <select name="count" defaultValue="20">
              {SIMULATION_QUESTION_COUNTS.map((count) => (
                <option key={count} value={count}>
                  {count} questões
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Tempo</span>
            <select name="minutes" defaultValue="">
              {SIMULATION_TIME_LIMITS.map((minutes) => (
                <option key={minutes ?? "livre"} value={minutes ?? ""}>
                  {minutes === null ? "Sem limite" : formatDuration(minutes * 60)}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.formActions}>
            <SubmitButton className={styles.primary} pendingLabel="Sorteando questões…">
              Começar simulado
            </SubmitButton>
          </div>
        </form>
      </section>

      <section className={styles.card} aria-labelledby="history-title">
        <div className={styles.cardHead}>
          <h2 id="history-title">Seus simulados</h2>
        </div>

        {simulations.length === 0 ? (
          <p className={styles.muted}>Você ainda não fez nenhum simulado.</p>
        ) : (
          <ul className={styles.history}>
            {simulations.map((simulation) => {
              const finished = simulation.status === "FINISHED";
              const score =
                finished && simulation.correctCount !== null
                  ? Math.round((simulation.correctCount / simulation.questionCount) * 100)
                  : null;

              return (
                <li key={simulation.id}>
                  <Link href={`/app/simulados/${simulation.id}`} className={styles.historyItem}>
                    <div>
                      <strong>{simulation.title}</strong>
                      <small>
                        {dateFormatter.format(simulation.startedAt)} · {simulation.questionCount} questões
                        {simulation.timeLimitMinutes ? ` · ${formatDuration(simulation.timeLimitMinutes * 60)}` : ""}
                      </small>
                    </div>
                    {finished ? (
                      <span className={styles.score}>
                        {simulation.correctCount}/{simulation.questionCount} · {score}%
                      </span>
                    ) : (
                      <span className={styles.inProgress}>
                        Em andamento · {simulation.answered}/{simulation.questionCount}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
