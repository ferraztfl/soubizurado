import Link from "next/link";
import { notFound } from "next/navigation";

import { LESSON_KINDS } from "@/modules/courses/domain/course";
import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import styles from "../../loja/loja.module.css";
import { createLessonAction, deleteModuleAction, moveLessonAction, moveModuleAction, saveModuleAction } from "../actions";
import local from "../cursos.module.css";
import { CourseForm } from "../course-form";

export const dynamic = "force-dynamic";

type CoursePageProps = Readonly<{
  params: Promise<{ courseId: string }>;
  searchParams: Promise<Readonly<{ ok?: string; error?: string }>>;
}>;

function MoveButtons({ action, idName, id, courseId }: Readonly<{ action: (formData: FormData) => Promise<void>; idName: string; id: string; courseId: string }>) {
  return (
    <span className={local.moves}>
      {(["up", "down"] as const).map((direction) => (
        <form key={direction} action={action}>
          <input type="hidden" name="courseId" value={courseId} />
          <input type="hidden" name={idName} value={id} />
          <input type="hidden" name="direction" value={direction} />
          <button type="submit" aria-label={direction === "up" ? "Mover para cima" : "Mover para baixo"}>
            {direction === "up" ? "↑" : "↓"}
          </button>
        </form>
      ))}
    </span>
  );
}

export default async function AdminCoursePage(props: CoursePageProps) {
  await requireAdminUser();

  const { courseId } = await props.params;
  const params = await props.searchParams;
  const course = /^[0-9a-f-]{36}$/i.test(courseId)
    ? await getPrismaClient().course.findUnique({
        where: { id: courseId },
        include: {
          modules: {
            orderBy: { position: "asc" },
            include: {
              lessons: {
                orderBy: { position: "asc" },
                select: { id: true, title: true, kind: true, isFreePreview: true, pdfAssetId: true, videoEmbedUrl: true, _count: { select: { questions: true } } },
              },
            },
          },
        },
      })
    : null;

  if (!course) {
    notFound();
  }

  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb}>
        <Link href="/admin/cursos">Cursos</Link> / <span>{course.title}</span>
      </nav>
      <h1 className={styles.title}>{course.title}</h1>
      {params.ok ? <p className={styles.info}>Alterações salvas.</p> : null}
      {params.error ? <p className={styles.error}>{params.error.slice(0, 300)}</p> : null}

      <section className={styles.card}>
        <h2>Conteúdo</h2>
        {course.modules.length === 0 ? <p className={styles.hint}>Comece criando um módulo (ex.: &quot;Língua Portuguesa&quot;).</p> : null}

        <ol className={local.modules}>
          {course.modules.map((module) => (
            <li key={module.id} className={local.module}>
              <div className={local.moduleHead}>
                <form action={saveModuleAction} className={local.inline}>
                  <input type="hidden" name="courseId" value={course.id} />
                  <input type="hidden" name="moduleId" value={module.id} />
                  <input name="title" defaultValue={module.title} required minLength={2} maxLength={160} aria-label="Título do módulo" />
                  <button type="submit">Renomear</button>
                </form>
                <MoveButtons action={moveModuleAction} idName="moduleId" id={module.id} courseId={course.id} />
                {module.lessons.length === 0 ? (
                  <form action={deleteModuleAction}>
                    <input type="hidden" name="courseId" value={course.id} />
                    <input type="hidden" name="moduleId" value={module.id} />
                    <button type="submit" className={local.danger}>
                      Excluir módulo
                    </button>
                  </form>
                ) : null}
              </div>

              <ol className={local.lessons}>
                {module.lessons.map((lesson) => (
                  <li key={lesson.id}>
                    <Link href={`/admin/cursos/${course.id}/aulas/${lesson.id}`}>{lesson.title}</Link>
                    <span className={local.meta}>
                      {LESSON_KINDS[lesson.kind as keyof typeof LESSON_KINDS] ?? lesson.kind}
                      {lesson.kind === "PDF" && !lesson.pdfAssetId ? " · sem arquivo" : ""}
                      {lesson.kind === "VIDEO" && !lesson.videoEmbedUrl ? " · sem vídeo" : ""}
                      {lesson.kind === "QUESTIONS" ? ` · ${lesson._count.questions} questões` : ""}
                      {lesson.isFreePreview ? " · grátis" : ""}
                    </span>
                    <MoveButtons action={moveLessonAction} idName="lessonId" id={lesson.id} courseId={course.id} />
                  </li>
                ))}
              </ol>

              <form action={createLessonAction} className={local.inline}>
                <input type="hidden" name="courseId" value={course.id} />
                <input type="hidden" name="moduleId" value={module.id} />
                <input name="title" required minLength={2} maxLength={160} placeholder="Nova aula" aria-label="Título da nova aula" />
                <select name="kind" defaultValue="TEXT" aria-label="Tipo da aula">
                  {Object.entries(LESSON_KINDS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button type="submit">Adicionar aula</button>
              </form>
            </li>
          ))}
        </ol>

        <form action={saveModuleAction} className={local.inline}>
          <input type="hidden" name="courseId" value={course.id} />
          <input name="title" required minLength={2} maxLength={160} placeholder="Novo módulo" aria-label="Título do novo módulo" />
          <button type="submit">Adicionar módulo</button>
        </form>
      </section>

      <section className={styles.card}>
        <h2>Dados do curso</h2>
        <CourseForm
          values={{
            id: course.id,
            title: course.title,
            slug: course.slug,
            subtitle: course.subtitle ?? "",
            description: course.description,
            isPublished: course.isPublished,
            sortOrder: course.sortOrder,
            coverUrl: course.coverAssetId ? `/api/loja/banners/${course.coverAssetId}` : null,
          }}
        />
        <p className={styles.hint}>
          Para vender: inclua o curso numa oferta em <Link href="/admin/loja">Loja</Link>.
        </p>
      </section>
    </main>
  );
}
