import Link from "next/link";
import { notFound } from "next/navigation";

import type { PublicQuestionDto } from "@/modules/question-bank/application/dto/public-question";
import { createListPublishedQuestionsUseCase } from "@/modules/question-bank/infrastructure/composition/question-bank-application";
import { sectionOf } from "@/modules/study/domain/official-simulation";
import { formatDuration, isSimulationExpired, remainingSeconds } from "@/modules/study/domain/simulation";
import { findStudentProfileId } from "@/modules/study/infrastructure/queries/answered-question-status";
import { sectionsFromFilters } from "@/modules/study/infrastructure/simulations/official-simulation-store";
import {
  finishSimulation,
  loadAnswerKeys,
  loadSimulation,
  type LoadedSimulation,
} from "@/modules/study/infrastructure/simulations/simulation-store";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";
import { PageHeader } from "@/shared/ui/page-header";

import { SimulationExam } from "../_components/simulation-exam";
import styles from "../simulados.module.css";

export const dynamic = "force-dynamic";

type SimulationPageProps = Readonly<{
  params: Promise<Readonly<{ simulationId: string }>>;
}>;

async function loadQuestions(simulation: LoadedSimulation): Promise<Map<string, PublicQuestionDto>> {
  const result = await createListPublishedQuestionsUseCase().execute({
    page: 1,
    pageSize: 100,
    filters: { ids: simulation.questions.map((item) => item.questionId) },
  });

  return new Map(result.items.map((question) => [question.id, question]));
}

export default async function SimulationPage({ params }: SimulationPageProps) {
  const { simulationId } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(simulationId)) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profileId = user ? await findStudentProfileId(user.id) : null;
  let simulation = profileId ? await loadSimulation(profileId, simulationId) : null;

  if (!profileId || !simulation) {
    notFound();
  }

  // Out of time: grade what was answered.
  if (simulation.status === "IN_PROGRESS" && isSimulationExpired(simulation.startedAt, simulation.timeLimitMinutes)) {
    await finishSimulation(profileId, simulation.id);
    simulation = (await loadSimulation(profileId, simulationId))!;
  }

  const questions = await loadQuestions(simulation);

  const sections = sectionsFromFilters(simulation.filters);

  if (simulation.status === "IN_PROGRESS") {
    return (
      <div className={styles.page}>
        <SimulationExam
          simulationId={simulation.id}
          title={simulation.title}
          official={sections !== null}
          remainingSeconds={remainingSeconds(simulation.startedAt, simulation.timeLimitMinutes)}
          questions={simulation.questions.flatMap((item) => {
            const question = questions.get(item.questionId);

            return question
              ? [
                  {
                    question,
                    position: item.position,
                    section: sections ? (sectionOf(sections, item.position)?.name ?? null) : null,
                    selected: item.selectedAlternativeId
                      ? ({ type: "MULTIPLE_CHOICE", alternativeId: item.selectedAlternativeId } as const)
                      : item.selectedTrueFalse !== null
                        ? ({ type: "TRUE_FALSE", value: item.selectedTrueFalse } as const)
                        : null,
                  },
                ]
              : [];
          })}
        />
      </div>
    );
  }

  return <SimulationResult simulation={simulation} questions={questions} sections={sections} />;
}

async function SimulationResult({
  simulation,
  questions,
  sections,
}: Readonly<{ simulation: LoadedSimulation; questions: Map<string, PublicQuestionDto>; sections: ReturnType<typeof sectionsFromFilters> }>) {
  const keys = await loadAnswerKeys(simulation.questions.map((item) => item.questionId));
  const correct = simulation.correctCount ?? simulation.questions.filter((item) => item.isCorrect).length;
  const total = simulation.questions.length;
  const answeredTotal = simulation.questions.filter((item) => item.selectedAlternativeId !== null || item.selectedTrueFalse !== null).length;
  const wrong = answeredTotal - correct;
  const blank = total - answeredTotal;
  const score = total === 0 ? 0 : Math.round((correct / total) * 100);
  const spent = simulation.finishedAt
    ? (simulation.finishedAt.getTime() - simulation.startedAt.getTime()) / 1000
    : null;

  const byDiscipline = new Map<string, { name: string; total: number; correct: number }>();

  for (const item of simulation.questions) {
    const question = questions.get(item.questionId);
    // Official exams are broken down by the subjects of the notice, in its order.
    const name = (sections ? sectionOf(sections, item.position)?.name : null) ?? question?.classification.discipline.name ?? "Questão indisponível";
    const entry = byDiscipline.get(name) ?? { name, total: 0, correct: 0 };
    entry.total += 1;
    entry.correct += item.isCorrect ? 1 : 0;
    byDiscipline.set(name, entry);
  }

  return (
    <div className={styles.page}>
      <PageHeader eyebrow="Simulado finalizado" title={simulation.title} description="Veja seu resultado e revise cada questão." />

      <section className={styles.resultHero}>
        <div>
          <span>Nota</span>
          <strong className={score >= 70 ? styles.good : score >= 50 ? styles.fair : styles.poor}>{score}%</strong>
        </div>
        <div>
          <span>Acertos</span>
          <strong>
            {correct}/{total}
          </strong>
        </div>
        <div>
          <span>Erros · Em branco</span>
          <strong>
            {wrong} · {blank}
          </strong>
        </div>
        <div>
          <span>Tempo{simulation.timeLimitMinutes ? ` (de ${formatDuration(simulation.timeLimitMinutes * 60)})` : ""}</span>
          <strong>{spent === null ? "—" : formatDuration(spent)}</strong>
        </div>
        <div className={styles.resultActions}>
          <Link href="/app/simulados" className={styles.primary}>
            Novo simulado
          </Link>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="by-discipline">
        <div className={styles.cardHead}>
          <h2 id="by-discipline">{sections ? "Por matéria do edital" : "Por matéria"}</h2>
        </div>
        <ul className={styles.breakdown}>
          {[...byDiscipline.values()]
            .sort((left, right) => (sections ? 0 : right.total - left.total))
            .map((entry) => {
              const value = Math.round((entry.correct / entry.total) * 100);

              return (
                <li key={entry.name}>
                  <span>{entry.name}</span>
                  <span className={styles.meter} aria-hidden="true">
                    <span
                      className={value >= 70 ? styles.good : value >= 50 ? styles.fair : styles.poor}
                      style={{ width: `${Math.max(value, 2)}%` }}
                    />
                  </span>
                  <strong>
                    {entry.correct}/{entry.total}
                  </strong>
                </li>
              );
            })}
        </ul>
      </section>

      <section className={styles.card} aria-labelledby="review">
        <div className={styles.cardHead}>
          <h2 id="review">Gabarito</h2>
          <p>Abra a questão para ver o texto completo, as estatísticas e anotar.</p>
        </div>
        <ol className={styles.review}>
          {simulation.questions.map((item) => {
            const question = questions.get(item.questionId);
            const key = keys.get(item.questionId);
            const chosen = item.selectedAlternativeId
              ? question?.alternatives.find((alternative) => alternative.id === item.selectedAlternativeId)?.label
              : item.selectedTrueFalse === null
                ? null
                : item.selectedTrueFalse
                  ? "Certo"
                  : "Errado";
            const expected =
              key?.label ?? (key?.trueFalse === null || key?.trueFalse === undefined ? "—" : key.trueFalse ? "Certo" : "Errado");

            return (
              <li key={item.questionId} className={item.isCorrect ? styles.reviewRight : styles.reviewWrong}>
                <span className={styles.reviewNumber}>{item.position + 1}</span>
                <div>
                  {question ? (
                    <Link href={`/app/questoes/${question.code}`}>{question.code}</Link>
                  ) : (
                    <span>Questão indisponível</span>
                  )}
                  <small>{question?.classification.discipline.name}</small>
                </div>
                <span className={styles.reviewAnswer}>
                  Sua: <strong>{chosen ?? "em branco"}</strong> · Gabarito: <strong>{expected}</strong>
                </span>
                <span aria-label={item.isCorrect ? "Acertou" : "Errou"}>{item.isCorrect ? "✓" : "✗"}</span>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
