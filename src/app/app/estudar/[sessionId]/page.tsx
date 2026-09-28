import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import type { PublicQuestionDto } from "@/modules/question-bank/application/dto/public-question";
import { createGetPublishedQuestionByIdUseCase } from "@/modules/question-bank/infrastructure/composition/question-bank-application";
import { findStudentProfileId } from "@/modules/study/infrastructure/queries/answered-question-status";
import { loadStudySession } from "@/modules/study/infrastructure/sessions/study-session-store";
import { ApplicationError } from "@/shared/errors/application-error";
import { hasVisibleContent } from "@/shared/ui/inline-markdown";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";
import { RichText } from "@/shared/ui/rich-text";

import { QuestionMedia } from "../../questoes/_components/question-media";
import { QuestionAnswerPanel } from "../../questoes/[questionId]/_components/question-answer-panel";
import questionStyles from "../../questoes/[questionId]/question-detail.module.css";
import styles from "../estudar.module.css";

export const dynamic = "force-dynamic";

type SessionPageProps = Readonly<{
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<Readonly<{ q?: string }>>;
}>;

const RESULT_LABEL = { correct: "acertou", wrong: "errou", pending: "a responder" } as const;

async function loadQuestion(id: string): Promise<PublicQuestionDto | null> {
  try {
    return await createGetPublishedQuestionByIdUseCase().execute(id);
  } catch (error) {
    // Unpublished since the session started: skipped.
    if (error instanceof ApplicationError) return null;
    throw error;
  }
}

export default async function StudySessionPage(props: SessionPageProps) {
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

  if (!session) {
    notFound();
  }

  const requested = Number((await props.searchParams).q);
  const total = session.questionIds.length;

  // No explicit position: resume at the first question still to answer.
  if (!Number.isSafeInteger(requested) || requested < 1 || requested > total) {
    if (session.resumeAt === null) {
      redirect(`/app/estudar/${session.id}/resultado`);
    }
    redirect(`/app/estudar/${session.id}?q=${session.resumeAt + 1}`);
  }

  const index = requested - 1;
  const question = await loadQuestion(session.questionIds[index]!);
  const answered = session.results.filter((result) => result !== "pending").length;
  const isLast = requested === total;
  const nextHref = isLast ? `/app/estudar/${session.id}/resultado` : `/app/estudar/${session.id}?q=${requested + 1}`;
  const supportContents = question
    ? question.supportContents.filter((support) => hasVisibleContent(support.content, question.textImages))
    : [];

  return (
    <div className={styles.page}>
      <header className={styles.sessionHeader}>
        <div>
          <span className={styles.eyebrow}>Sessão de estudo</span>
          <h1>{session.title}</h1>
        </div>
        <Link href="/app/estudar" className={styles.secondary}>
          Sair da sessão
        </Link>
      </header>

      <nav className={styles.progress} aria-label={`Questão ${requested} de ${total}; ${answered} respondidas`}>
        <span className={styles.progressLabel}>
          Questão {requested} de {total} · {answered} respondidas
        </span>
        <ol className={styles.dots}>
          {session.results.map((result, position) => (
            <li key={session.questionIds[position]}>
              <Link
                href={`/app/estudar/${session.id}?q=${position + 1}`}
                className={`${styles.dot} ${styles[`dot_${result}`]} ${position === index ? styles.dotCurrent : ""}`}
                aria-label={`Questão ${position + 1}: ${RESULT_LABEL[result]}`}
                aria-current={position === index ? "step" : undefined}
              />
            </li>
          ))}
        </ol>
      </nav>

      {question ? (
        <article className={questionStyles.question}>
          <div className={questionStyles.meta}>
            <span className={questionStyles.code}>{question.code}</span>
            <span>{question.classification.discipline.name}</span>
            {question.classification.area ? <span>{question.classification.area.name}</span> : null}
            {question.isOriginal ? <span className={questionStyles.original}>Questão inédita</span> : null}
            {question.examination?.year ? <span>{question.examination.year}</span> : null}
            {question.examination?.board ? (
              <span>{question.examination.board.acronym ?? question.examination.board.name}</span>
            ) : null}
          </div>

          {supportContents.length > 0 ? (
            <section className={questionStyles.supportContent} aria-label="Texto de apoio">
              <span className={questionStyles.supportLabel}>Texto de apoio</span>
              {supportContents.map((support) => (
                <p key={support.id}>
                  <RichText text={support.content} images={question.textImages} />
                </p>
              ))}
            </section>
          ) : null}

          <div className={questionStyles.statement}>
            <RichText text={question.statement} images={question.textImages} />
          </div>

          <QuestionMedia media={question.media} fallbackAlt="Imagem da questão" />

          {/* Keyed by question: a fresh panel (no previous answer) for each one. */}
          <QuestionAnswerPanel key={question.id} question={question} />
        </article>
      ) : (
        <p className={styles.notice}>Esta questão saiu do banco para revisão. Siga para a próxima.</p>
      )}

      <nav className={styles.sessionNav} aria-label="Navegação da sessão">
        {requested > 1 ? (
          <Link href={`/app/estudar/${session.id}?q=${requested - 1}`} className={styles.secondary}>
            ← Anterior
          </Link>
        ) : (
          <span />
        )}
        <Link href={nextHref} className={styles.primaryLink}>
          {isLast ? "Ver resultado" : "Próxima questão →"}
        </Link>
      </nav>
    </div>
  );
}
