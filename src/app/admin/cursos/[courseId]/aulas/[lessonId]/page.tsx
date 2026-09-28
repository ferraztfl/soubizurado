import Link from "next/link";
import { notFound } from "next/navigation";

import { LESSON_KINDS } from "@/modules/courses/domain/course";
import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import styles from "../../../../loja/loja.module.css";
import { deleteLessonAction, saveLessonAction } from "../../../actions";

export const dynamic = "force-dynamic";

type LessonPageProps = Readonly<{
  params: Promise<{ courseId: string; lessonId: string }>;
  searchParams: Promise<Readonly<{ ok?: string; error?: string }>>;
}>;

export default async function AdminLessonPage(props: LessonPageProps) {
  await requireAdminUser();

  const { courseId, lessonId } = await props.params;
  const params = await props.searchParams;
  const valid = /^[0-9a-f-]{36}$/i.test(courseId) && /^[0-9a-f-]{36}$/i.test(lessonId);
  const lesson = valid
    ? await getPrismaClient().courseLesson.findFirst({
        where: { id: lessonId, module: { courseId } },
        include: {
          module: { select: { title: true, course: { select: { id: true, title: true } } } },
          pdf: { select: { sizeBytes: true } },
          questions: { orderBy: { position: "asc" }, select: { question: { select: { publicNumber: true } } } },
        },
      })
    : null;

  if (!lesson) {
    notFound();
  }

  const course = lesson.module.course;

  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb}>
        <Link href="/admin/cursos">Cursos</Link> / <Link href={`/admin/cursos/${course.id}`}>{course.title}</Link> /{" "}
        <span>{lesson.module.title}</span>
      </nav>
      <h1 className={styles.title}>{lesson.title}</h1>
      {params.ok ? <p className={styles.info}>Aula salva.</p> : null}
      {params.error ? <p className={styles.error}>{params.error.slice(0, 400)}</p> : null}

      <section className={styles.card}>
        <form action={saveLessonAction} className={styles.form}>
          <input type="hidden" name="courseId" value={course.id} />
          <input type="hidden" name="lessonId" value={lesson.id} />

          <label className={`${styles.field} ${styles.full}`}>
            <span>Título</span>
            <input name="title" defaultValue={lesson.title} required minLength={2} maxLength={160} />
          </label>
          <label className={styles.field}>
            <span>Tipo</span>
            <select name="kind" defaultValue={lesson.kind}>
              {Object.entries(LESSON_KINDS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Duração (minutos, opcional)</span>
            <input name="durationMinutes" type="number" min={1} max={1440} defaultValue={lesson.durationMinutes ?? ""} />
          </label>

          <label className={`${styles.field} ${styles.full}`}>
            <span>Texto da aula / descrição (aceita **negrito**, _itálico_ e quebras de linha)</span>
            <textarea name="body" defaultValue={lesson.body} rows={10} maxLength={100000} />
          </label>

          <label className={`${styles.field} ${styles.full}`}>
            <span>Vídeo — link de incorporação (embed) do Panda Video, Bunny Stream, Vimeo ou YouTube</span>
            <input name="videoEmbedUrl" defaultValue={lesson.videoEmbedUrl ?? ""} maxLength={500} placeholder="https://player.vimeo.com/video/…" />
          </label>

          <label className={`${styles.field} ${styles.full}`}>
            <span>
              PDF (até 50 MB) {lesson.pdf ? `— arquivo atual: ${(Number(lesson.pdf.sizeBytes) / 1024 / 1024).toFixed(1)} MB` : "— nenhum"}
            </span>
            <input name="pdf" type="file" accept="application/pdf" />
          </label>
          {lesson.pdf ? (
            <div className={styles.checks}>
              <label>
                <input type="checkbox" name="removePdf" /> Remover o PDF atual
              </label>
            </div>
          ) : null}

          <label className={`${styles.field} ${styles.full}`}>
            <span>Questões da aula (códigos separados por vírgula ou linha, na ordem; só publicadas)</span>
            <textarea
              name="questionCodes"
              rows={3}
              defaultValue={lesson.questions.map((row) => `Q${row.question.publicNumber}`).join(", ")}
              placeholder="Q100001, Q100002, Q100003"
            />
          </label>

          <div className={styles.checks}>
            <label>
              <input type="checkbox" name="isFreePreview" defaultChecked={lesson.isFreePreview} /> Aula grátis (amostra para quem não comprou)
            </label>
          </div>

          <div className={styles.full}>
            <button type="submit" className={styles.primary}>
              Salvar aula
            </button>
          </div>
        </form>
      </section>

      <section className={styles.card}>
        <h2>Excluir aula</h2>
        <form action={deleteLessonAction} className={styles.checks}>
          <input type="hidden" name="courseId" value={course.id} />
          <input type="hidden" name="lessonId" value={lesson.id} />
          <label>
            <input type="checkbox" name="confirm" /> Confirmo: excluir a aula (o progresso dos alunos nela é apagado)
          </label>
          <button type="submit" className={styles.secondary}>
            Excluir aula
          </button>
        </form>
      </section>
    </main>
  );
}
