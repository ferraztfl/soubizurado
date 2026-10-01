import Link from "next/link";
import { redirect } from "next/navigation";

import { listMyCourses } from "@/modules/courses/infrastructure/course-access";
import { findStudentProfileId } from "@/modules/study/infrastructure/queries/answered-question-status";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";
import { EmptyState } from "@/shared/ui/empty-state";
import { PageHeader } from "@/shared/ui/page-header";

import styles from "./cursos.module.css";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function MyCoursesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profileId = await findStudentProfileId(user.id);
  const mine = profileId ? await listMyCourses(profileId) : [];
  const owned = new Set(mine.map((course) => course.slug));

  // Published courses on sale that the student does not have yet.
  const onSale = await getPrismaClient().course.findMany({
    where: { isPublished: true, offerGrants: { some: { offer: { isActive: true } } } },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: {
      slug: true,
      title: true,
      subtitle: true,
      offerGrants: { where: { offer: { isActive: true } }, orderBy: { offer: { priceCents: "asc" } }, take: 1, select: { offer: { select: { slug: true } } } },
    },
  });
  const available = onSale.filter((course) => !owned.has(course.slug));

  return (
    <div className={styles.page}>
      <PageHeader eyebrow="Estudos" title="Meus cursos" description="Aulas em texto, PDF e vídeo e listas de questões do seu concurso." />

      {mine.length === 0 ? (
        <div className={styles.card}>
          <EmptyState
            icon="🎓"
            title="Você ainda não tem cursos"
            description="Os cursos vêm nos combos da Loja, preparados para cada concurso."
          />
          <div className={styles.center}>
            <Link href="/app/loja" className={styles.primary}>
              Ver a Loja
            </Link>
          </div>
        </div>
      ) : (
        <ul className={styles.grid}>
          {mine.map((course) => (
            <li key={course.slug} className={styles.courseCard}>
              {course.coverAssetId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.cover} src={`/api/loja/banners/${course.coverAssetId}`} alt="" width={1200} height={675} loading="lazy" />
              ) : null}
              <h2>{course.title}</h2>
              {course.subtitle ? <p className={styles.muted}>{course.subtitle}</p> : null}
              <div className={styles.progressArea}>
              <div className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={course.percent} aria-label={`Progresso em ${course.title}`}>
                <div className={styles.fill} style={{ width: `${course.percent}%` }} />
              </div>
              <span className={styles.muted}>
                {course.completedLessons}/{course.totalLessons} aulas · {course.percent}%
                {course.accessEndsAt ? ` · acesso até ${dateFormatter.format(course.accessEndsAt)}` : ""}
              </span>
              <Link href={`/app/cursos/${course.slug}`} className={styles.primary}>
                {course.completedLessons === 0 ? "Começar" : "Continuar"}
              </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 ? (
        <section className={styles.card}>
          <h2>Outros cursos</h2>
          <ul className={styles.list}>
            {available.map((course) => (
              <li key={course.slug}>
                <div>
                  <strong>{course.title}</strong>
                  {course.subtitle ? <span>{course.subtitle}</span> : null}
                </div>
                <div className={styles.row}>
                  <Link href={`/app/cursos/${course.slug}`}>Ver aulas grátis</Link>
                  {course.offerGrants[0] ? <Link href={`/loja/${course.offerGrants[0].offer.slug}`}>Comprar</Link> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
