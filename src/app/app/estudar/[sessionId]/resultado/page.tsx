import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { formatQuestionCode } from "@/modules/question-bank/domain/question-code";
import { findStudentProfileId } from "@/modules/study/infrastructure/queries/answered-question-status";
import { finishStudySession, loadStudySession } from "@/modules/study/infrastructure/sessions/study-session-store";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";

import styles from "../../estudar.module.css";

export const dynamic = "force-dynamic";

type ResultPageProps = Readonly<{
  params: Promise<{ sessionId: string }>;
}>;

const LABEL = { correct: "Acertou", wrong: "Errou — volta para revisão amanhã", pending: "Não respondida" } as const;

export default async function StudySessionResultPage(props: ResultPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { sessionId } = await props.params;
  const profileId = await findStudentProfileId(user.id);
  const session = profileId && /^[0-9a-f-]{36}$/i.test(sessionId) ? await loadStudySession(profileId, sessionId) : null;

  if (!session || !profileId) {
    notFound();
  }

  await finishStudySession(profileId, session);

  const questions = await getPrismaClient().question.findMany({
    where: { id: { in: [...session.questionIds] } },
    select: { id: true, publicNumber: true, statement: true, discipline: { select: { name: true } } },
  });
  const byId = new Map(questions.map((question) => [question.id, question]));
  const correct = session.results.filter((result) => result === "correct").length;
  const answered = session.results.filter((result) => result !== "pending").length;
  const rate = answered === 0 ? 0 : Math.round((correct / answered) * 100);

  return (
    <div className={styles.page}>
      <header className={styles.sessionHeader}>
        <div>
          <span className={styles.eyebrow}>Resultado da sessão</span>
          <h1>{session.title}</h1>
        </div>
      </header>

      <section className={styles.score} aria-label="Placar">
        <div>
          <strong>
            {correct}/{session.questionIds.length}
          </strong>
          <span>acertos</span>
        </div>
        <div>
          <strong>{rate}%</strong>
          <span>de acerto nas respondidas</span>
        </div>
        <div>
          <strong>{session.results.filter((result) => result === "wrong").length}</strong>
          <span>para revisar amanhã</span>
        </div>
      </section>

      <section className={styles.card}>
        <h2>Questões</h2>
        <ol className={styles.resultList}>
          {session.questionIds.map((id, position) => {
            const question = byId.get(id);
            const result = session.results[position]!;

            return (
              <li key={id} className={styles[`result_${result}`]}>
                <div>
                  <strong>{question ? formatQuestionCode(question.publicNumber) : `Questão ${position + 1}`}</strong>
                  <span>
                    {LABEL[result]}
                    {question?.discipline ? ` · ${question.discipline.name}` : ""}
                  </span>
                </div>
                <Link href={`/app/estudar/${session.id}?q=${position + 1}`} className={styles.secondary}>
                  {result === "pending" ? "Responder" : "Rever"}
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      <nav className={styles.sessionNav}>
        <Link href="/app/estudar" className={styles.secondary}>
          Voltar ao Estudar
        </Link>
        <Link href="/app/desempenho" className={styles.primaryLink}>
          Ver meu desempenho
        </Link>
      </nav>
    </div>
  );
}
