"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { formatDuration } from "@/modules/contests/domain/import-progress";

import styles from "../../loja/loja.module.css";
import { ContestForm } from "../contest-form";
import { createNewsDraftAction, startNoticeImportAction } from "./actions";
import type { NoticeImportResult, NoticeImportStatus } from "./import-types";
import progress from "./notice-importer.module.css";

type Option = Readonly<{ id: string; name: string }>;

type NoticeImporterProps = Readonly<{
  localAvailable: boolean;
  localModel: string;
  remoteAvailable: boolean;
  contests: readonly Option[];
  organizations: readonly string[];
  boards: readonly Option[];
  careers: readonly Option[];
  offers: readonly Option[];
}>;

const POLL_MS = 1_000;

/** Upload → AI suggestions (with live progress) → review in the normal contest form → save; plus a news draft. */
export function NoticeImporter({ localAvailable, localModel, remoteAvailable, contests, organizations, boards, careers, offers }: NoticeImporterProps) {
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<NoticeImportStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NoticeImportResult | null>(null);
  const resultRef = useRef<HTMLElement | null>(null);

  // Follow the job until it ends.
  useEffect(() => {
    if (!jobId) return;
    let stopped = false;

    async function poll() {
      try {
        const response = await fetch(`/api/admin/notice-import/${jobId}`, { cache: "no-store" });
        const body = (await response.json()) as NoticeImportStatus & { error: string | null };
        if (stopped) return;
        if (!response.ok) {
          setError(body.error ?? "Não foi possível acompanhar a leitura.");
          setJobId(null);
          return;
        }
        setStatus(body);
        if (body.phase === "done" && body.result) {
          setResult(body.result);
          setJobId(null);
        } else if (body.phase === "error") {
          setError(body.error ?? "Não foi possível ler o edital.");
          setJobId(null);
        }
      } catch {
        // Network hiccup: try again on the next tick.
      }
    }

    void poll();
    const timer = window.setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [jobId]);

  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setStatus(null);
    setUploading(true);
    try {
      const started = await startNoticeImportAction(new FormData(event.currentTarget));
      if (started.ok) setJobId(started.jobId);
      else setError(started.message);
    } catch {
      setError("Não foi possível enviar o PDF. Tente de novo.");
    } finally {
      setUploading(false);
    }
  }

  const busy = uploading || jobId !== null;
  const percent = uploading ? 2 : status?.percent ?? 0;

  return (
    <>
      <section className={styles.card}>
        <h2>1. Envie o edital oficial</h2>
        <form onSubmit={onSubmit} className={styles.form}>
          <label className={`${styles.field} ${styles.full}`}>
            <span>PDF do edital (até 30 MB; precisa ter texto — PDF escaneado não funciona)</span>
            <input name="pdf" type="file" accept="application/pdf" required disabled={busy} />
          </label>
          <label className={styles.field}>
            <span>Link oficial do edital (https, opcional)</span>
            <input name="noticeUrl" type="url" maxLength={500} placeholder="https://…" disabled={busy} />
          </label>
          <label className={styles.field}>
            <span>Atualizar um concurso já cadastrado (opcional)</span>
            <select name="contestId" defaultValue="" disabled={busy}>
              <option value="">Não — é um concurso novo</option>
              {contests.map((contest) => (
                <option key={contest.id} value={contest.id}>
                  {contest.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Como ler o edital</span>
            <select name="ai" defaultValue="none" disabled={busy}>
              <option value="none">Somente regras — segundos (recomendado)</option>
              <option value="local" disabled={!localAvailable}>
                Regras + IA local — {localModel}, alguns minutos{localAvailable ? "" : " (indisponível)"}
              </option>
              <option value="remote" disabled={!remoteAvailable}>
                Regras + IA online (chave do .env){remoteAvailable ? "" : " — não configurada"}
              </option>
            </select>
          </label>
          <div className={styles.full}>
            <button type="submit" className={styles.primary} disabled={busy}>
              {busy ? "Lendo o edital…" : "Ler o edital"}
            </button>
          </div>
        </form>

        {busy || (status && status.phase !== "error" && !result) ? (
          <div className={progress.box} role="status" aria-live="polite">
            <div className={progress.head}>
              <strong>{uploading ? "Enviando o PDF" : status?.label ?? "Preparando"}</strong>
              <span className={progress.percent}>{percent}%</span>
            </div>
            <div
              className={progress.track}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-label="Progresso da leitura do edital"
            >
              <div className={progress.fill} style={{ width: `${percent}%` }} />
            </div>
            <ol className={progress.steps}>
              {(["pdf", "excerpts", "reading", "writing", "checking"] as const).map((phase) => {
                const order = ["received", "pdf", "excerpts", "reading", "writing", "checking", "done"];
                const current = order.indexOf(status?.phase ?? "received");
                const index = order.indexOf(phase);
                return (
                  <li key={phase} className={index < current ? progress.stepDone : index === current ? progress.stepCurrent : progress.step}>
                    {
                      {
                        pdf: "Texto do PDF",
                        excerpts: "Trechos",
                        reading: "IA lendo",
                        writing: "IA escrevendo",
                        checking: "Conferência",
                      }[phase]
                    }
                  </li>
                );
              })}
            </ol>
            <p className={progress.meta}>
              {status ? `Tempo decorrido: ${formatDuration(status.elapsedSeconds)}` : "Enviando…"}
              {status?.remainingSeconds !== null && status?.remainingSeconds !== undefined
                ? ` · faltam cerca de ${formatDuration(status.remainingSeconds)}`
                : ""}
              {status?.provider === "local" ? " · IA local (no processador)" : ""}
            </p>
            {status?.phase === "reading" && status.provider === "local" ? (
              <p className={progress.note}>
                Nesta fase a IA local não informa o andamento: a porcentagem é estimada pela velocidade medida deste computador. Pode
                continuar usando outras abas; não feche esta.
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? <p className={styles.error}>{error}</p> : null}
      </section>

      {result ? (
        <>
          <section className={styles.card} ref={resultRef}>
            <h2>2. Revise e salve o concurso</h2>
            <p className={styles.hint}>
              Tudo abaixo foi lido do edital. Confira cada campo com o PDF antes de salvar — ao salvar, as regras
              normais do cadastro valem. Marque “Publicado no site” só depois de revisar.
              {result.usage.provider === "none"
                ? ` (leitura por regras em ${formatDuration(result.usage.seconds)}.)`
                : ` (regras + IA ${result.usage.provider === "local" ? "local" : "online"}: ${formatDuration(result.usage.seconds)}, ${result.usage.inputTokens.toLocaleString("pt-BR")} tokens lidos.)`}
            </p>
            {result.warnings.length > 0 ? (
              <ul className={styles.error}>
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
            <ContestForm key={result.key} values={result.values} organizations={organizations} boards={boards} careers={careers} offers={offers} />
          </section>

          {result.news ? (
            <section className={styles.card}>
              <h2>3. Rascunho da notícia</h2>
              <p className={styles.hint}>
                Texto montado a partir dos dados do edital. Ele vira um <strong>rascunho</strong> no Blog (não é publicado daqui): lá você
                revisa, põe a capa e publica.
              </p>
              <form key={`news-${result.key}`} action={createNewsDraftAction} className={styles.form}>
                <input type="hidden" name="stateCode" value={result.values.stateCode ?? ""} />
                <input type="hidden" name="contestId" value={result.values.id ?? ""} />
                <label className={`${styles.field} ${styles.full}`}>
                  <span>Título</span>
                  <input name="title" defaultValue={result.news.title} maxLength={200} required />
                </label>
                <label className={`${styles.field} ${styles.full}`}>
                  <span>Resumo</span>
                  <textarea name="excerpt" defaultValue={result.news.excerpt} rows={2} maxLength={320} />
                </label>
                <label className={`${styles.field} ${styles.full}`}>
                  <span>Texto</span>
                  <textarea name="body" defaultValue={result.news.body} rows={18} maxLength={200000} required />
                </label>
                <div className={styles.full}>
                  <button type="submit" className={styles.secondary}>
                    Criar rascunho no Blog
                  </button>
                </div>
              </form>
            </section>
          ) : null}
        </>
      ) : null}
    </>
  );
}
