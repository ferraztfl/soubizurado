import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import styles from "../../loja/loja.module.css";
import { deleteContestAction } from "../actions";
import { ContestForm } from "../contest-form";
import { contestFormValues } from "../contest-form-values";
import { loadContestFormOptions } from "../load-contest-form-options";

export const dynamic = "force-dynamic";

type EditContestPageProps = Readonly<{
  params: Promise<{ contestId: string }>;
  searchParams: Promise<Readonly<{ ok?: string; error?: string }>>;
}>;

export default async function EditContestPage(props: EditContestPageProps) {
  await requireAdminUser();

  const { contestId } = await props.params;
  const params = await props.searchParams;
  const [contest, options] = await Promise.all([
    /^[0-9a-f-]{36}$/i.test(contestId) ? getPrismaClient().contest.findUnique({
          where: { id: contestId },
          include: { contestPositions: { orderBy: { sortOrder: "asc" } } },
        }) : null,
    loadContestFormOptions(),
  ]);

  if (!contest) {
    notFound();
  }

  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb}>
        <Link href="/admin/concursos">Concursos</Link> / <span>{contest.name}</span>
      </nav>
      <h1 className={styles.title}>Editar concurso</h1>
      {params.ok ? <p className={styles.info}>Concurso salvo.</p> : null}
      {params.error ? <p className={styles.error}>{params.error.slice(0, 300)}</p> : null}
      <p className={styles.hint}>
        {contest.isPublished ? (
          <>
            No ar em <Link href={`/concursos/${contest.slug}`}>/concursos/{contest.slug}</Link>
          </>
        ) : (
          "Ainda não está no site (marque “Publicado no site”)."
        )}{" "}
        · <Link href={`/admin/concursos/${contest.id}/edital`}>Edital verticalizado (matérias e assuntos por cargo)</Link>
      </p>

      <section className={styles.card}>
        <ContestForm
          values={contestFormValues(contest)}
          {...options}
        />
      </section>

      <section className={styles.card}>
        <h2>Excluir concurso</h2>
        <form action={deleteContestAction} className={styles.checks}>
          <input type="hidden" name="contestId" value={contest.id} />
          <label>
            <input type="checkbox" name="confirm" /> Confirmo a exclusão (para tirar do site sem excluir, desmarque “Publicado”)
          </label>
          <button type="submit" className={styles.secondary}>
            Excluir
          </button>
        </form>
      </section>
    </main>
  );
}
