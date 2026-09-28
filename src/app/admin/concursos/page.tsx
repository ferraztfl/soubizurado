import Link from "next/link";

import { CONTEST_STATUSES, isContestStatus, vacanciesLabel } from "@/modules/contests/domain/contest";
import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import styles from "../loja/loja.module.css";

export const dynamic = "force-dynamic";

type ContestsAdminPageProps = Readonly<{ searchParams: Promise<Readonly<{ ok?: string; error?: string }>> }>;

export default async function ContestsAdminPage(props: ContestsAdminPageProps) {
  await requireAdminUser();

  const params = await props.searchParams;
  const contests = await getPrismaClient().contest.findMany({
    orderBy: [{ isPublished: "desc" }, { updatedAt: "desc" }],
    take: 300,
    select: {
      id: true,
      slug: true,
      name: true,
      organizationName: true,
      stateCode: true,
      status: true,
      vacancies: true,
      hasReserveList: true,
      isFeatured: true,
      isPublished: true,
      board: { select: { name: true } },
    },
  });

  return (
    <main className={styles.page}>
      <header>
        <p className={styles.eyebrow}>Conteúdo</p>
        <h1 className={styles.title}>Concursos</h1>
        <p className={styles.description}>
          Concursos acompanhados pela equipe (previstos, autorizados, com edital). Os dados vêm do edital oficial; o
          resumo é escrito por nós. Aparecem em /concursos, na página inicial e nas notícias ligadas a eles.
        </p>
      </header>

      {params.ok === "excluido" ? <p className={styles.info}>Concurso excluído.</p> : null}
      {params.error ? <p className={styles.error}>{params.error.slice(0, 300)}</p> : null}

      <div>
        <Link href="/admin/concursos/novo" className={styles.primary} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
          Novo concurso
        </Link>{" "}
        <Link href="/admin/concursos/importar" className={styles.secondary} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
          Importar do edital (PDF)
        </Link>
      </div>

      <section className={styles.card}>
        <h2>Concursos ({contests.length})</h2>
        {contests.length === 0 ? (
          <p className={styles.hint}>Nenhum concurso cadastrado ainda.</p>
        ) : (
          <ul className={styles.list}>
            {contests.map((contest) => (
              <li key={contest.id}>
                <div>
                  <strong>
                    {contest.name}
                    {contest.isFeatured ? " ★" : ""}
                  </strong>
                  <span>
                    {contest.organizationName} · {contest.stateCode ?? "Nacional"} · {contest.board?.name ?? "banca a definir"} ·{" "}
                    {vacanciesLabel(contest.vacancies, contest.hasReserveList)}
                  </span>
                </div>
                <div className={styles.row}>
                  <span className={contest.isPublished ? styles.badgeOn : styles.badgeOff}>
                    {isContestStatus(contest.status) ? CONTEST_STATUSES[contest.status] : contest.status}
                    {contest.isPublished ? "" : " · oculto"}
                  </span>
                  {contest.isPublished ? <Link href={`/concursos/${contest.slug}`}>Ver</Link> : null}
                  <Link href={`/admin/concursos/${contest.id}`}>Editar</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
