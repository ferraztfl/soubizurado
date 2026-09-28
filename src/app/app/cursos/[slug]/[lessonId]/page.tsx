import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { allowedVideoEmbedUrl, nextLessonId } from "@/modules/courses/domain/course";
import { loadCourseOutline } from "@/modules/courses/infrastructure/course-access";
import { toggleLessonCompleteAction } from "@/modules/courses/presentation/course-actions";
import { createListPublishedQuestionsUseCase } from "@/modules/question-bank/infrastructure/composition/question-bank-application";
import { findStudentProfileId } from "@/modules/study/infrastructure/queries/answered-question-status";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";
import { RichText } from "@/shared/ui/rich-text";

import { QuestionMedia } from "../../../questoes/_components/question-media";
import { QuestionAnswerPanel } from "../../../questoes/[questionId]/_components/question-answer-panel";
import questionStyles from "../../../questoes/[questionId]/question-detail.module.css";
import styles from "../../cursos.module.css";

export const dynamic = "force-dynamic";

type LessonPageProps = Readonly<{ params: Promise<{ slug: string; lessonId: string }> }>;

export default async function LessonPage(props: LessonPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { slug, lessonId } = await props.params;
  const profileId = await findStudentProfileId(user.id);
  const course =
    profileId && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && /^[0-9a-f-]{36}$/i.test(lessonId)
      ? await loadCourseOutline(slug, profileId)
      : null;
  const outline = course?.modules.flatMap((module) => module.lessons.map((lesson) => ({ ...lesson, moduleTitle: module.title })));
  const summary = outline?.find((lesson) => lesson.id === lessonId);

  if (!course || !summary) {
    notFound();
  }

  // Locked lesson: back to the course page (which shows how to buy it).
  if (!course.hasAccess && !summary.isFreePreview) {
    redirect(`/app/cursos/${course.slug}`);
  }

  const lesson = await getPrismaClient().courseLesson.findUnique({
    where: { id: lessonId },
    select: {
      body: true,
      videoEmbedUrl: true,
      pdfAssetId: true,
      questions: { orderBy: { position: "asc" }, select: { questionId: true } },
    },
  });

  if (!lesson) {
    notFound();
  }

  const questionIds = lesson.questions.map((row) => row.questionId);
  const questions = questionIds.length
    ? [
        ...(await createListPublishedQuestionsUseCase().execute({ page: 1, pageSize: 100, filters: { ids: questionIds } })).items,
      ].sort((a, b) => questionIds.indexOf(a.id) - questionIds.indexOf(b.id))
    : [];

  // Re-checked at render time too (defense in depth: only allow-listed players).
  const video = lesson.videoEmbedUrl ? allowedVideoEmbedUrl(lesson.videoEmbedUrl) : null;
  const index = course.orderedLessonIds.indexOf(lessonId);
  const previous = index > 0 ? course.orderedLessonIds[index - 1] : null;
  const next = nextLessonId(course.orderedLessonIds, lessonId);
  const done = course.completed.has(lessonId);

  return (
    <div className={styles.page}>
      <header className={styles.lessonHeader}>
        <Link href={`/app/cursos/${course.slug}`} className={styles.back}>
          ← {course.title}
        </Link>
        <span className={styles.muted}>
          {summary.moduleTitle} · aula {index + 1} de {course.orderedLessonIds.length}
        </span>
        <h1>{summary.title}</h1>
      </header>

      {video ? (
        <div className={styles.video}>
          <iframe
            src={video}
            title={summary.title}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            loading="lazy"
          />
        </div>
      ) : summary.kind === "VIDEO" ? (
        <p className={styles.locked}>O vídeo desta aula está sendo preparado.</p>
      ) : null}

      {lesson.pdfAssetId ? (
        <section className={styles.card}>
          <div className={styles.row}>
            <h2>Material em PDF</h2>
            <a href={`/api/cursos/aulas/${lessonId}/pdf?download=1`} className={styles.secondary}>
              Baixar PDF
            </a>
          </div>
          <iframe className={styles.pdf} src={`/api/cursos/aulas/${lessonId}/pdf`} title={`PDF — ${summary.title}`} />
        </section>
      ) : summary.kind === "PDF" ? (
        <p className={styles.locked}>O PDF desta aula está sendo preparado.</p>
      ) : null}

      {lesson.body ? (
        <section className={styles.card}>
          <div className={styles.text}>
            <RichText text={lesson.body} />
          </div>
        </section>
      ) : null}

      {questions.length > 0 ? (
        <section className={styles.card}>
          <h2>Questões da aula ({questions.length})</h2>
          <ol className={styles.questions}>
            {questions.map((question, position) => (
              <li key={question.id} className={questionStyles.question}>
                <div className={questionStyles.meta}>
                  <span className={questionStyles.code}>{question.code}</span>
                  <span>{position + 1}ª questão</span>
                  {question.examination?.board ? <span>{question.examination.board.acronym ?? question.examination.board.name}</span> : null}
                  {question.examination?.year ? <span>{question.examination.year}</span> : null}
                </div>
                <div className={questionStyles.statement}>
                  <RichText text={question.statement} images={question.textImages} />
                </div>
                <QuestionMedia media={question.media} fallbackAlt="Imagem da questão" />
                <QuestionAnswerPanel key={question.id} question={question} compact />
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <nav className={styles.lessonNav} aria-label="Navegação entre aulas">
        {previous ? (
          <Link href={`/app/cursos/${course.slug}/${previous}`} className={styles.secondary}>
            ← Anterior
          </Link>
        ) : (
          <span />
        )}
        <form action={toggleLessonCompleteAction}>
          <input type="hidden" name="courseSlug" value={course.slug} />
          <input type="hidden" name="lessonId" value={lessonId} />
          <input type="hidden" name="done" value={done ? "false" : "true"} />
          <button type="submit" className={done ? styles.secondary : styles.primary}>
            {done ? "✓ Concluída (desmarcar)" : next ? "Concluir e ir para a próxima" : "Concluir aula"}
          </button>
        </form>
        {next ? (
          <Link href={`/app/cursos/${course.slug}/${next}`} className={styles.secondary}>
            Próxima →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
