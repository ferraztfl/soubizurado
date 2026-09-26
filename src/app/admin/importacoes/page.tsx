import Link from "next/link";

import { OFFICIAL_EXAM_BOARDS } from "@/modules/imports/application/official-exams/official-exam";
import { listUploads } from "@/modules/imports/infrastructure/official-exams/official-exam-upload-store";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import styles from "./importacoes.module.css";

export const dynamic = "force-dynamic";

const JOB_STATUS: Readonly<Record<string, { label: string; className: string }>> = {
  PENDING: { label: "Na fila", className: styles.badgeNeutral! },
  RUNNING: { label: "Em execução", className: styles.badgeInfo! },
  COMPLETED: { label: "Concluída", className: styles.badgeOk! },
  PARTIAL: { label: "Parcial", className: styles.badgeWarning! },
  FAILED: { label: "Falhou", className: styles.badgeDanger! },
};

function formatDate(value: Date | string): string {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default async function ImportsPage() {
  const [uploads, jobs] = await Promise.all([
    listUploads(15),
    getPrismaClient().importJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true,
        provider: true,
        status: true,
        receivedCount: true,
        importedCount: true,
        duplicateCount: true,
        reviewCount: true,
        failedCount: true,
        createdAt: true,
        source: { select: { name: true } },
      },
    }),
  ]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Banco de questões</p>
          <h1>Central de importações</h1>
          <p className={styles.description}>
            Envie a prova e o gabarito oficiais em PDF. O sistema identifica a
            banca, lê as questões, imagens e anuladas, mostra uma prévia e
            importa tudo para a revisão editorial.
          </p>
        </div>

        <Link href="/admin/importacoes/nova" className={styles.primaryButton}>
          Nova importação
        </Link>
      </header>

      <section className={styles.card}>
        <div>
          <h2 className={styles.cardTitle}>Provas enviadas</h2>
          <p className={styles.cardMeta}>Envios recentes e o resultado de cada importação.</p>
        </div>

        {uploads.length === 0 ? (
          <p className={styles.empty}>Nenhuma prova enviada ainda.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Enviada em</th>
                  <th>Arquivo</th>
                  <th>Banca</th>
                  <th>Questões</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((upload) => (
                  <tr key={upload.uploadId}>
                    <td>{upload.createdAt ? formatDate(upload.createdAt) : "—"}</td>
                    <td>
                      <Link href={`/admin/importacoes/nova/${upload.uploadId}`}>
                        {upload.analysis?.bookletFileName ?? upload.uploadId}
                      </Link>
                    </td>
                    <td>{upload.analysis?.board ? OFFICIAL_EXAM_BOARDS[upload.analysis.board] : "Não identificada"}</td>
                    <td>{upload.analysis?.questions.length ?? 0}</td>
                    <td>
                      {upload.result ? (
                        <span className={`${styles.badge} ${styles.badgeOk}`}>
                          Importada · {upload.result.counts.imported} novas
                        </span>
                      ) : upload.analysis?.blockingIssues.length ? (
                        <span className={`${styles.badge} ${styles.badgeDanger}`}>Com pendências</span>
                      ) : (
                        <span className={`${styles.badge} ${styles.badgeWarning}`}>Aguardando confirmação</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.card}>
        <div>
          <h2 className={styles.cardTitle}>Histórico de jobs</h2>
          <p className={styles.cardMeta}>Todas as execuções do pipeline de importação (PDF, APIs e scripts).</p>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Início</th>
                <th>Fonte</th>
                <th>Situação</th>
                <th>Recebidas</th>
                <th>Novas</th>
                <th>Duplicadas</th>
                <th>Revisão</th>
                <th>Falhas</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const status = JOB_STATUS[job.status] ?? { label: "Desconhecida", className: styles.badgeNeutral! };

                return (
                  <tr key={job.id}>
                    <td>{formatDate(job.createdAt)}</td>
                    <td>{job.source.name}</td>
                    <td>
                      <span className={`${styles.badge} ${status.className}`}>{status.label}</span>
                    </td>
                    <td>{job.receivedCount}</td>
                    <td>{job.importedCount}</td>
                    <td>{job.duplicateCount}</td>
                    <td>{job.reviewCount}</td>
                    <td>{job.failedCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
