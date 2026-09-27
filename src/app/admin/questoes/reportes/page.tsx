import Link from "next/link";

import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { formatQuestionCode } from "@/modules/question-bank/domain/question-code";
import {
  isQuestionErrorReason,
  QUESTION_ERROR_REASONS,
} from "@/modules/study/domain/question-error-report";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import { closeQuestionErrorReportAction } from "./actions";
import styles from "./reportes.module.css";

export const dynamic = "force-dynamic";

type ReportsPageProps = Readonly<{
  searchParams: Promise<Readonly<{ status?: string; closed?: string; error?: string }>>;
}>;

const STATUS_TABS = [
  { value: "OPEN", label: "Em aberto" },
  { value: "RESOLVED", label: "Resolvidos" },
  { value: "DISMISSED", label: "Descartados" },
] as const;

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default async function QuestionReportsPage(props: ReportsPageProps) {
  await requireAdminUser();

  const searchParams = await props.searchParams;
  const status = STATUS_TABS.find((tab) => tab.value === searchParams.status)?.value ?? "OPEN";
  const prisma = getPrismaClient();

  const [reports, counts] = await Promise.all([
    prisma.questionErrorReport.findMany({
      where: { status },
      orderBy: { createdAt: status === "OPEN" ? "asc" : "desc" },
      take: 100,
      select: {
        id: true,
        reason: true,
        details: true,
        resolutionNote: true,
        createdAt: true,
        resolvedAt: true,
        reporter: { select: { displayName: true } },
        resolver: { select: { displayName: true } },
        question: {
          select: {
            id: true,
            publicNumber: true,
            statement: true,
            discipline: { select: { name: true } },
            examination: { select: { title: true } },
          },
        },
      },
    }),
    prisma.questionErrorReport.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const countOf = (value: string) => counts.find((row) => row.status === value)?._count._all ?? 0;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Banco de questões</p>
          <h1>Reportes de erro</h1>
          <p className={styles.description}>
            Problemas apontados pelos alunos. Corrija a questão pela página de edição (fica registrado no histórico
            de revisões) e depois marque o reporte como resolvido. Se não houver problema, descarte.
          </p>
        </div>
      </header>

      {searchParams.closed ? (
        <div className={styles.noticeSuccess} role="status">
          Reporte {searchParams.closed === "resolvido" ? "marcado como resolvido" : "descartado"}.
        </div>
      ) : null}

      {searchParams.error ? (
        <div className={styles.noticeError} role="alert">
          {searchParams.error.slice(0, 300)}
        </div>
      ) : null}

      <nav className={styles.tabs} aria-label="Situação dos reportes">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/questoes/reportes?status=${tab.value}`}
            className={tab.value === status ? styles.tabActive : styles.tab}
            aria-current={tab.value === status ? "page" : undefined}
          >
            {tab.label} <span>{countOf(tab.value)}</span>
          </Link>
        ))}
      </nav>

      {reports.length === 0 ? (
        <p className={styles.empty}>Nenhum reporte nesta situação.</p>
      ) : (
        <ol className={styles.list}>
          {reports.map((report) => {
            const code = formatQuestionCode(report.question.publicNumber);

            return (
              <li key={report.id} className={styles.card}>
                <div className={styles.cardHead}>
                  <strong className={styles.reason}>
                    {isQuestionErrorReason(report.reason) ? QUESTION_ERROR_REASONS[report.reason] : report.reason}
                  </strong>
                  <span className={styles.meta}>
                    {code} · {report.question.discipline?.name ?? "Sem matéria"}
                    {report.question.examination ? ` · ${report.question.examination.title}` : ""}
                  </span>
                  <span className={styles.meta}>
                    {report.reporter?.displayName ?? "Aluno"} · {dateFormatter.format(report.createdAt)}
                  </span>
                </div>

                {report.details ? <p className={styles.details}>{report.details}</p> : null}

                <p className={styles.statement}>
                  {report.question.statement.length > 280
                    ? `${report.question.statement.slice(0, 280)}…`
                    : report.question.statement}
                </p>

                <div className={styles.links}>
                  <Link href={`/admin/questoes/${report.question.id}/editar`}>Editar questão</Link>
                  <Link href={`/app/questoes/${code}`} target="_blank" rel="noreferrer">
                    Ver como aluno
                  </Link>
                </div>

                {status === "OPEN" ? (
                  <form action={closeQuestionErrorReportAction} className={styles.closeForm}>
                    <input type="hidden" name="reportId" value={report.id} />
                    <input
                      name="resolutionNote"
                      maxLength={500}
                      placeholder="Nota interna (opcional): o que foi feito"
                      aria-label="Nota interna"
                    />
                    <button type="submit" name="status" value="RESOLVED" className={styles.resolve}>
                      Resolvido
                    </button>
                    <button type="submit" name="status" value="DISMISSED" className={styles.dismiss}>
                      Descartar
                    </button>
                  </form>
                ) : (
                  <p className={styles.meta}>
                    {status === "RESOLVED" ? "Resolvido" : "Descartado"} por {report.resolver?.displayName ?? "admin"}
                    {report.resolvedAt ? ` em ${dateFormatter.format(report.resolvedAt)}` : ""}
                    {report.resolutionNote ? ` — ${report.resolutionNote}` : ""}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
