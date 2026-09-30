import Link from "next/link";
import { notFound } from "next/navigation";

import { formatSyllabusText, totalQuestions } from "@/modules/contests/domain/syllabus";
import { loadContestSyllabi, type LoadedSyllabus } from "@/modules/contests/infrastructure/syllabus-store";
import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import styles from "../../../loja/loja.module.css";
import { deleteSyllabusAction, saveSyllabusAction } from "./actions";

export const dynamic = "force-dynamic";

type SyllabusPageProps = Readonly<{
  params: Promise<{ contestId: string }>;
  searchParams: Promise<Readonly<{ ok?: string; error?: string }>>;
}>;

const EXAMPLE = `# Língua Portuguesa | 10 | Bloco I
1. Compreensão e interpretação de textos.
2. Tipologias e gêneros textuais.
# Direito Constitucional | 10 | Bloco III
1. Dos princípios fundamentais.`;

/** "Edital verticalizado" of each position: subjects, number of questions and syllabus topics. */
export default async function ContestSyllabusPage(props: SyllabusPageProps) {
  await requireAdminUser();

  const { contestId } = await props.params;
  const params = await props.searchParams;
  const contest = /^[0-9a-f-]{36}$/i.test(contestId)
    ? await getPrismaClient().contest.findUnique({ where: { id: contestId }, select: { id: true, name: true, slug: true, isPublished: true } })
    : null;
  if (!contest) notFound();

  const syllabi = await loadContestSyllabi(contest.id);

  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb}>
        <Link href="/admin/concursos">Concursos</Link> / <Link href={`/admin/concursos/${contest.id}`}>{contest.name}</Link> /{" "}
        <span>Edital verticalizado</span>
      </nav>
      <h1 className={styles.title}>Edital verticalizado</h1>
      <p className={styles.hint}>
        Um bloco por cargo: as matérias da prova com o número de questões e os assuntos do conteúdo programático, copiados do
        edital oficial. É a base da página “o que estudar”, do checklist do aluno, dos simulados e da teoria. Matérias com o mesmo
        nome de uma matéria da taxonomia ficam ligadas a ela (nada é criado na taxonomia).
      </p>
      {params.ok ? <p className={styles.info}>Salvo.</p> : null}
      {params.error ? <p className={styles.error}>{params.error.slice(0, 300)}</p> : null}

      {syllabi.map((syllabus) => (
        <SyllabusCard key={syllabus.id} contestId={contest.id} contestSlug={contest.slug} contestPublished={contest.isPublished} syllabus={syllabus} />
      ))}

      <section className={styles.card}>
        <h2>{syllabi.length > 0 ? "Adicionar outro cargo" : "Adicionar o primeiro cargo"}</h2>
        <SyllabusForm contestId={contest.id} syllabus={null} />
      </section>
    </main>
  );
}

function SyllabusCard({
  contestId,
  contestSlug,
  contestPublished,
  syllabus,
}: Readonly<{ contestId: string; contestSlug: string; contestPublished: boolean; syllabus: LoadedSyllabus }>) {
  const topics = syllabus.subjects.reduce((sum, subject) => sum + subject.topics.length, 0);
  const unmatched = syllabus.subjects.filter((subject) => !subject.discipline).map((subject) => subject.name);
  const questions = totalQuestions(syllabus.subjects);

  return (
    <section className={styles.card} id={`cargo-${syllabus.id}`}>
      <h2>{syllabus.title}</h2>
      <p className={styles.hint}>
        {syllabus.subjects.length} matérias · {topics} assuntos{questions === null ? "" : ` · ${questions} questões objetivas`}
        {syllabus.essayPoints === null ? "" : ` · redação ${syllabus.essayPoints} pontos`} ·{" "}
        {syllabus.isPublished && contestPublished ? (
          <Link href={`/concursos/${contestSlug}/o-que-estudar/${syllabus.slug}`}>no ar</Link>
        ) : syllabus.isPublished ? (
          "publicado (o concurso ainda não está no site)"
        ) : (
          "rascunho"
        )}
      </p>
      {unmatched.length > 0 ? (
        <p className={styles.hint}>
          Sem matéria correspondente na taxonomia: {unmatched.join(", ")}. Crie ou ajuste na{" "}
          <Link href="/admin/taxonomia">Taxonomia</Link> e salve este cargo de novo para ligar.
        </p>
      ) : null}
      <SyllabusForm contestId={contestId} syllabus={syllabus} />
      <form action={deleteSyllabusAction} className={styles.checks}>
        <input type="hidden" name="contestId" value={contestId} />
        <input type="hidden" name="syllabusId" value={syllabus.id} />
        <label>
          <input type="checkbox" name="confirm" /> Confirmo excluir este cargo (apaga também o checklist dos alunos)
        </label>
        <button type="submit" className={styles.secondary}>
          Excluir cargo
        </button>
      </form>
    </section>
  );
}

function SyllabusForm({ contestId, syllabus }: Readonly<{ contestId: string; syllabus: LoadedSyllabus | null }>) {
  return (
    <form action={saveSyllabusAction} className={styles.form}>
      <input type="hidden" name="contestId" value={contestId} />
      {syllabus ? <input type="hidden" name="syllabusId" value={syllabus.id} /> : null}
      <label className={styles.field}>
        <span>Cargo (como no edital)</span>
        <input name="title" defaultValue={syllabus?.title ?? ""} required minLength={2} maxLength={160} placeholder="Soldado (Praça QPMG)" />
      </label>
      <label className={styles.field}>
        <span>Endereço (slug)</span>
        <input name="slug" defaultValue={syllabus?.slug ?? ""} maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="gerado a partir do cargo" />
      </label>
      <label className={styles.field}>
        <span>Pontos da redação</span>
        <input name="essayPoints" type="number" min={0} max={1000} defaultValue={syllabus?.essayPoints ?? ""} placeholder="40" />
      </label>
      <label className={styles.field}>
        <span>Duração da prova (minutos)</span>
        <input name="durationMinutes" type="number" min={1} max={1440} defaultValue={syllabus?.durationMinutes ?? ""} placeholder="270" />
      </label>
      <label className={`${styles.field} ${styles.full}`}>
        <span>Matérias e assuntos — “# Matéria | nº de questões | bloco” e, abaixo, um assunto por linha</span>
        <textarea
          name="text"
          rows={syllabus ? 16 : 10}
          required
          defaultValue={syllabus ? formatSyllabusText(syllabus.subjects) : ""}
          placeholder={EXAMPLE}
        />
      </label>
      <label className={`${styles.field} ${styles.full}`}>
        <span>Observações (nota mínima, critérios — opcional)</span>
        <textarea name="notes" rows={3} maxLength={2000} defaultValue={syllabus?.notes ?? ""} />
      </label>
      <div className={`${styles.checks} ${styles.full}`}>
        <label>
          <input type="checkbox" name="isPublished" defaultChecked={syllabus?.isPublished ?? false} /> Publicado no site
        </label>
      </div>
      <div className={styles.full}>
        <button type="submit" className={styles.primary}>
          {syllabus ? "Salvar cargo" : "Adicionar cargo"}
        </button>
      </div>
    </form>
  );
}
