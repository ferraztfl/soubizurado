import Link from "next/link";

import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { OFFICIAL_EXAM_READERS, type OfficialExamReader } from "@/modules/imports/application/official-exams/official-exam";
import {
  isBatchRunning,
  previewInbox,
  refreshImportedItems,
} from "@/modules/imports/infrastructure/batch/batch-import-runner";
import {
  batchInboxRoot,
  listBatches,
  loadBatch,
  saveBatch,
  type BatchItemState,
} from "@/modules/imports/infrastructure/batch/batch-import-store";

import { AutoRefresh } from "../../_components/auto-refresh";
import { SubmitButton } from "../../_components/submit-button";
import styles from "../importacoes.module.css";
import { startBatchAnalysisAction, startBatchImportAction } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = Readonly<{
  searchParams: Promise<Readonly<{ lote?: string; aviso?: string }>>;
}>;

const STATE_LABELS: Readonly<Record<BatchItemState, { label: string; className: string | undefined }>> = {
  PENDING: { label: "Aguardando análise", className: styles.badgeNeutral },
  READY: { label: "Pronta", className: styles.badgeOk },
  NEEDS_REVIEW: { label: "Conferir dados", className: styles.badgeWarning },
  BLOCKED: { label: "Com pendências", className: styles.badgeDanger },
  FAILED: { label: "Falhou na leitura", className: styles.badgeDanger },
  IMPORTING: { label: "Importando…", className: styles.badgeInfo },
  IMPORTED: { label: "Importada", className: styles.badgeOk },
  IMPORT_FAILED: { label: "Falhou na importação", className: styles.badgeDanger },
};

const NOTICES: Readonly<Record<string, string>> = {
  "sem-pares": "Nenhuma prova pareada na pasta de entrada (ou já existe um lote em andamento).",
  "nada-a-importar": "Não há provas prontas para importar neste lote (ou já existe um lote em andamento).",
};

function readerLabel(reader: string | null): string {
  return reader && reader in OFFICIAL_EXAM_READERS ? OFFICIAL_EXAM_READERS[reader as OfficialExamReader] : "—";
}

export default async function BatchImportPage(props: PageProps) {
  await requireAdminUser();

  const searchParams = await props.searchParams;
  const running = isBatchRunning();
  const inbox = await previewInbox();
  const batches = await listBatches(10);
  const selected = searchParams.lote ? await loadBatch(searchParams.lote) : batches[0] ?? null;

  if (selected && !running && (await refreshImportedItems(selected))) {
    await saveBatch(selected);
  }

  const ready = selected?.items.filter((item) => item.state === "READY").length ?? 0;
  const active = running || selected?.status === "ANALYZING" || selected?.status === "IMPORTING";

  return (
    <main className={styles.page}>
      <AutoRefresh active={active} intervalMs={4_000} />

      <nav className={styles.breadcrumb} aria-label="Navegação estrutural">
        <Link href="/admin/importacoes">Central de importações</Link>
        <span aria-hidden="true">/</span>
        <span>Importação em lote</span>
      </nav>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Importação em lote</p>
          <h1>Fila de provas oficiais</h1>
          <p className={styles.description}>
            Coloque cadernos e gabaritos oficiais na pasta de entrada, leia a pasta e importe as provas prontas de
            uma vez. Cada prova passa pelos mesmos leitores, validações e prévia da importação individual.
          </p>
        </div>
      </header>

      {searchParams.aviso && NOTICES[searchParams.aviso] ? (
        <div className={styles.notice} role="status">
          {NOTICES[searchParams.aviso]}
        </div>
      ) : null}

      <section className={styles.card}>
        <div>
          <h2 className={styles.cardTitle}>Pasta de entrada</h2>
          <p className={styles.cardMeta}>
            <code>{batchInboxRoot()}</code>
            <br />
            Uma subpasta por prova (caderno + arquivo com &ldquo;gabarito&rdquo; no nome), ou arquivos soltos
            pareados pelo nome (<code>prova.pdf</code> + <code>prova-gabarito.pdf</code>). Um gabarito único na raiz
            vale para todas as subpastas sem gabarito (ex.: gabarito com todos os cargos).
          </p>
        </div>

        <dl className={styles.stats}>
          <div className={styles.stat}>
            <dt>Provas pareadas</dt>
            <dd>{inbox.pairs.length}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Arquivos sem par</dt>
            <dd>{inbox.unpaired.length}</dd>
          </div>
        </dl>

        {inbox.pairs.length > 0 ? (
          <ul className={styles.steps}>
            {inbox.pairs.slice(0, 30).map((pair) => (
              <li key={`${pair.booklet}|${pair.answerKey}`}>
                <strong>{pair.label}</strong> — {pair.booklet} + {pair.answerKey}
              </li>
            ))}
          </ul>
        ) : null}

        {inbox.unpaired.length > 0 ? (
          <ul className={styles.steps}>
            {inbox.unpaired.slice(0, 30).map((entry) => (
              <li key={entry.file}>
                {entry.file}: {entry.reason}
              </li>
            ))}
          </ul>
        ) : null}

        <form action={startBatchAnalysisAction}>
          <SubmitButton
            className={styles.primaryButton}
            pendingLabel="Iniciando…"
            disabled={running || inbox.pairs.length === 0}
          >
            Ler pasta de entrada
          </SubmitButton>
        </form>
      </section>

      {selected ? (
        <section className={styles.card}>
          <div className={styles.header}>
            <div>
              <h2 className={styles.cardTitle}>
                Lote de {new Date(selected.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
              </h2>
              <p className={styles.cardMeta}>
                {selected.status === "ANALYZING"
                  ? running
                    ? "Analisando as provas…"
                    : "Análise interrompida (o servidor reiniciou). Os arquivos restantes continuam na pasta de entrada."
                  : selected.status === "IMPORTING"
                    ? running
                      ? "Importando as provas prontas…"
                      : "Importação interrompida. Clique em importar para continuar."
                    : selected.status === "DONE"
                      ? `Importação concluída. ${selected.classificationEnqueued} questões enviadas para a classificação automática.`
                      : "Análise concluída. Confira as provas e importe as prontas."}
              </p>
            </div>

            <form action={startBatchImportAction}>
              <input type="hidden" name="batchId" value={selected.id} />
              <SubmitButton
                className={styles.primaryButton}
                pendingLabel="Iniciando…"
                disabled={running || ready === 0 || selected.status === "ANALYZING"}
              >
                Importar todas as prontas ({ready})
              </SubmitButton>
            </form>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Prova</th>
                  <th>Formato</th>
                  <th>Questões</th>
                  <th>Situação</th>
                  <th>Detalhes</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {selected.items.map((item) => {
                  const state = STATE_LABELS[item.state];

                  return (
                    <tr key={`${item.booklet}|${item.answerKey}`}>
                      <td>
                        <strong>{item.label}</strong>
                        <br />
                        <small>
                          {[item.organization, item.careerPosition, item.year].filter(Boolean).join(" · ") || item.booklet}
                        </small>
                      </td>
                      <td>{readerLabel(item.reader)}</td>
                      <td>
                        {item.importable}/{item.questions}
                      </td>
                      <td>
                        <span className={`${styles.badge} ${state.className ?? ""}`}>{state.label}</span>
                      </td>
                      <td>
                        {item.state === "IMPORTED"
                          ? `${item.imported ?? 0} novas, ${item.duplicates ?? 0} já existentes`
                          : item.error ??
                            (item.issues[0] ??
                              (item.state === "NEEDS_REVIEW"
                                ? `Falta: ${[!item.boardSlug && "banca", !item.organization && "órgão", !item.careerPosition && "cargo", !item.year && "ano"].filter(Boolean).join(", ")}`
                                : ""))}
                      </td>
                      <td>
                        {item.uploadId ? <Link href={`/admin/importacoes/nova/${item.uploadId}`}>Abrir prévia</Link> : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {batches.length > 1 ? (
            <p className={styles.cardMeta}>
              Lotes anteriores:{" "}
              {batches
                .filter((batch) => batch.id !== selected.id)
                .map((batch) => (
                  <span key={batch.id}>
                    <Link href={`/admin/importacoes/lote?lote=${batch.id}`}>
                      {new Date(batch.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </Link>{" "}
                  </span>
                ))}
            </p>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
