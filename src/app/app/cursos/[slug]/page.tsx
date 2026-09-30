import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { LESSON_KINDS, progressPercent } from "@/modules/courses/domain/course";
import { loadCourseOutline } from "@/modules/courses/infrastructure/course-access";
import { findStudentProfileId } from "@/modules/study/infrastructure/queries/answered-question-status";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";
import { RichText } from "@/shared/ui/rich-text";

import styles from "../cursos.module.css";

export const dynamic = "force-dynamic";

type CoursePageProps = Readonly<{ params: Promise<{ slug: string }> }>;

const KIND_ICON: Readonly<Record<string, string>> = { TEXT: "📄", PDF: "📑", VIDEO: "▶", QUESTIONS: "✎" };

export default async function CoursePage(props: CoursePageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { slug } = await props.params;
  const profileId = await findStudentProfileId(user.id);
  const course = profileId && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) ? await loadCourseOutline(slug, profileId) : null;

  if (!course) {
    notFound();
  }

  const lessons = course.modules.flatMap((module) => module.lessons);
  const percent = progressPercent(lessons.length, lessons.filter((lesson) => course.completed.has(lesson.id)).length);
  const resume = lessons.find((lesson) => !course.completed.has(lesson.id) && (course.hasAccess || lesson.isFreePreview));

  return (
    <div className={styles.page}>
      <header className={styles.courseHeader}>
        <Link href="/app/cursos" className={styles.back}>
          ← Meus cursos
        </Link>
        <h1>{course.title}</h1>
        {course.subtitle ? <p className={styles.muted}>{course.subtitle}</p> : null}
        {course.hasAccess ? (
          <>
            <div className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Progresso no curso">
              <div className={styles.fill} style={{ width: `${percent}%` }} />
            </div>
            <span className={styles.muted}>{percent}% concluído</span>
          </>
        ) : (
          <p className={styles.locked}>
            Você está vendo a amostra grátis deste curso.{" "}
            {course.offerSlug ? <Link href={`/loja/${course.offerSlug}`}>Comprar o curso completo</Link> : "Em breve na Loja."}
          </p>
        )}
        {course.reading && (course.hasAccess || lessons.some((lesson) => lesson.id === course.reading?.lessonId && lesson.isFreePreview)) ? (
          <Link href={`/app/cursos/${course.slug}/${course.reading.lessonId}?continuar=${course.reading.scrollPercent}`} className={styles.primary}>
            Continuar de onde parei
          </Link>
        ) : resume ? (
          <Link href={`/app/cursos/${course.slug}/${resume.id}`} className={styles.primary}>
            {percent === 0 ? "Começar" : "Continuar de onde parei"}
          </Link>
        ) : null}
      </header>

      {course.description ? (
        <section className={styles.card}>
          <div className={styles.text}>
            <RichText text={course.description} />
          </div>
        </section>
      ) : null}

      <section className={styles.card}>
        <h2>Conteúdo</h2>
        {course.modules.length === 0 ? <p className={styles.muted}>As aulas deste curso estão sendo preparadas.</p> : null}
        {course.modules.map((module, moduleIndex) => (
          <div key={module.id} className={styles.module}>
            <h3>
              Módulo {moduleIndex + 1} · {module.title}
            </h3>
            <ol className={styles.lessons}>
              {module.lessons.map((lesson) => {
                const open = course.hasAccess || lesson.isFreePreview;
                const done = course.completed.has(lesson.id);
                return (
                  <li key={lesson.id} className={done ? styles.lessonDone : styles.lesson}>
                    <span className={styles.lessonIcon} aria-hidden="true">
                      {done ? "✓" : open ? KIND_ICON[lesson.kind] ?? "•" : "🔒"}
                    </span>
                    {open ? <Link href={`/app/cursos/${course.slug}/${lesson.id}`}>{lesson.title}</Link> : <span>{lesson.title}</span>}
                    <span className={styles.lessonMeta}>
                      {LESSON_KINDS[lesson.kind as keyof typeof LESSON_KINDS] ?? lesson.kind}
                      {lesson.durationMinutes ? ` · ${lesson.durationMinutes} min` : ""}
                      {lesson.isFreePreview && !course.hasAccess ? " · grátis" : ""}
                      {lesson.syllabusTopicId && lesson.contentStatus !== "REVIEWED" ? " · em preparação" : ""}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </section>
    </div>
  );
}
