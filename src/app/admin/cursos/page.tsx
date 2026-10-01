import Link from "next/link";

import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import styles from "../loja/loja.module.css";
import { CourseForm } from "./course-form";

export const dynamic = "force-dynamic";

type CoursesPageProps = Readonly<{ searchParams: Promise<Readonly<{ error?: string }>> }>;

export default async function AdminCoursesPage(props: CoursesPageProps) {
  await requireAdminUser();

  const params = await props.searchParams;
  const now = new Date();
  const courses = await getPrismaClient().course.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      isPublished: true,
      _count: {
        select: {
          modules: true,
          entitlements: { where: { revokedAt: null, OR: [{ endsAt: null }, { endsAt: { gt: now } }] } },
        },
      },
      modules: { select: { _count: { select: { lessons: true } } } },
    },
  });

  return (
    <main className={styles.page}>
      <header>
        <p className={styles.eyebrow}>Operação</p>
        <h1 className={styles.title}>Cursos</h1>
        <p className={styles.description}>
          Área de membros: cursos com módulos e aulas (texto, PDF, vídeo e listas de questões). O aluno acessa quando
          compra uma oferta que inclui o curso (Loja) — ou pelas aulas marcadas como grátis.
        </p>
      </header>

      {params.error ? <p className={styles.error}>{params.error.slice(0, 300)}</p> : null}

      <section className={styles.card}>
        <h2>Cursos</h2>
        {courses.length === 0 ? (
          <p className={styles.hint}>Nenhum curso ainda. Crie o primeiro abaixo.</p>
        ) : (
          <ul className={styles.list}>
            {courses.map((course) => (
              <li key={course.id}>
                <div>
                  <strong>{course.title}</strong>
                  <span>
                    {course._count.modules} módulos · {course.modules.reduce((sum, row) => sum + row._count.lessons, 0)} aulas ·{" "}
                    {course._count.entitlements} alunos com acesso
                  </span>
                </div>
                <div className={styles.row}>
                  <span className={course.isPublished ? styles.badgeOn : styles.badgeOff}>{course.isPublished ? "Publicado" : "Rascunho"}</span>
                  <Link href={`/admin/cursos/${course.id}`}>Editar</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.card}>
        <h2>Novo curso</h2>
        <CourseForm values={{ id: null, title: "", slug: "", subtitle: "", description: "", isPublished: false, sortOrder: 0, coverUrl: null }} />
      </section>
    </main>
  );
}
