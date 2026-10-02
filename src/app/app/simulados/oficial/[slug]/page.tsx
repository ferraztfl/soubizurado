import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { hasCourseAccess } from "@/modules/courses/infrastructure/course-access";
import { formatExamDuration } from "@/modules/study/domain/official-simulation";
import { formatDuration } from "@/modules/study/domain/simulation";
import { findStudentProfileId } from "@/modules/study/infrastructure/queries/answered-question-status";
import { hasPremiumAccess } from "@/modules/study/infrastructure/queries/student-access";
import { listOfficialAttempts, loadOfficialExam } from "@/modules/study/infrastructure/simulations/official-simulation-store";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";

import { StartOfficialExam } from "../../_components/start-official-exam";
import styles from "../oficial.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Simulado oficial", robots: { index: false } };

type PageProps = Readonly<{ params: Promise<{ slug: string }> }>;

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

export default async function OfficialExamPage({ params }: PageProps) {
  const { slug } = await params;
  const exam = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) ? await loadOfficialExam(slug) : null;

  if (!exam) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/app/simulados/oficial/${slug}`);
  }

  const profileId = await findStudentProfileId(user.id);
  const allowed = profileId ? (await hasPremiumAccess(profileId)) || (await hasCourseAccess(profileId, exam.courseId)) : false;
  const attempts = profileId && allowed ? await listOfficialAttempts(profileId, exam.syllabusId) : [];
  const { blueprint } = exam;
  const missing = blueprint.totalWanted - blueprint.totalAvailable;

  return (
    <div className={styles.page}>
      <Link href="/app/simulados" className={styles.back}>
        ← Simulados
      </Link>

      <header className={styles.hero}>
        <span className={styles.eyebrow}>Simulado oficial</span>
        <h1>{exam.name}</h1>
        <p>A prova do edital, do jeito que ela é: mesma quantidade de questões em cada matéria, na ordem do edital e com o tempo da prova.</p>

        <dl className={styles.facts}>
          <div>
            <dt>Questões</dt>
            <dd>{blueprint.totalWanted}</dd>
          </div>
          <div>
            <dt>Tempo de prova</dt>
            <dd>{formatExamDuration(exam.durationMinutes)}</dd>
          </div>
          <div>
            <dt>Matérias</dt>
            <dd>{blueprint.subjects.length}</dd>
          </div>
        </dl>
      </header>

      <section className={styles.card} aria-labelledby="blueprint">
        <h2 id="blueprint">Composição da prova</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Matéria</th>
              <th scope="col">Na prova</th>
              <th scope="col">No nosso banco</th>
            </tr>
          </thead>
          <tbody>
            {blueprint.subjects.map((subject) => (
              <tr key={subject.id}>
                <th scope="row">{subject.name}</th>
                <td>{subject.questionCount}</td>
                <td className={subject.shortage > 0 ? styles.short : undefined}>
                  {subject.available} {subject.shortage > 0 ? "(incompleto)" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!blueprint.complete ? (
          <p className={styles.notice}>
            O banco ainda está reunindo questões de algumas matérias: o simulado sai com {blueprint.totalAvailable} das {blueprint.totalWanted} questões
            ({missing} a menos). Ele fica completo à medida que novas questões são publicadas.
          </p>
        ) : null}
      </section>

      <section className={styles.card} aria-labelledby="rules">
        <h2 id="rules">Como funciona</h2>
        <ul className={styles.rules}>
          <li>
            <strong>Cronômetro de prova:</strong> {formatExamDuration(exam.durationMinutes)} contados a partir do início. Ao zerar, a prova é encerrada e corrigida com o que você marcou.
          </li>
          <li>
            <strong>Tela cheia:</strong> a prova abre em tela cheia, sem menu nem distrações. Dá para sair e voltar quando quiser.
          </li>
          <li>
            <strong>Uma questão por vez</strong>, com o mapa da prova ao lado, marcação para revisão e atalhos de teclado (← →, A–E, M).
          </li>
          <li>
            <strong>Sem gabarito durante a prova.</strong> O resultado, por matéria do edital, aparece só no final, com o gabarito de cada questão.
          </li>
          <li>
            Suas respostas são salvas a cada clique. Se a internet cair, entre de novo: a prova continua de onde parou, com o tempo correndo.
          </li>
        </ul>

        {allowed ? (
          blueprint.totalAvailable > 0 ? (
            <StartOfficialExam courseSlug={exam.courseSlug} />
          ) : (
            <p className={styles.notice}>Ainda não há questões publicadas para montar este simulado.</p>
          )
        ) : (
          <div className={styles.locked}>
            <strong>O simulado oficial é do Premium e de quem tem o combo deste concurso.</strong>
            <Link href="/app/loja" className={styles.start}>
              Ver a Loja
            </Link>
          </div>
        )}
      </section>

      {attempts.length > 0 ? (
        <section className={styles.card} aria-labelledby="attempts">
          <h2 id="attempts">Suas tentativas</h2>
          <ul className={styles.attempts}>
            {attempts.map((attempt) => (
              <li key={attempt.id}>
                <div>
                  <strong>{dateFormatter.format(attempt.startedAt)}</strong>
                  <span>
                    {attempt.status === "FINISHED"
                      ? `${attempt.correctCount ?? 0} de ${attempt.questionCount} acertos${attempt.finishedAt ? ` · ${formatDuration((attempt.finishedAt.getTime() - attempt.startedAt.getTime()) / 1000)}` : ""}`
                      : "Em andamento"}
                  </span>
                </div>
                <Link href={`/app/simulados/${attempt.id}`}>{attempt.status === "FINISHED" ? "Ver resultado" : "Continuar"}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
