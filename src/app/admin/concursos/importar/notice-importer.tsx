"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import styles from "../../loja/loja.module.css";
import { ContestForm } from "../contest-form";
import { createNewsDraftAction, importNoticeAction, type NoticeImportState } from "./actions";

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

const initial: NoticeImportState = { status: "idle" };

function ReadButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.primary} disabled={pending}>
      {pending ? "Lendo o edital… (com a IA local pode levar alguns minutos — não feche a página)" : "Ler o edital com IA"}
    </button>
  );
}

/** Upload → AI suggestions → review in the normal contest form → save; plus a news draft. */
export function NoticeImporter({ localAvailable, localModel, remoteAvailable, contests, organizations, boards, careers, offers }: NoticeImporterProps) {
  const [state, action] = useActionState(importNoticeAction, initial);

  return (
    <>
      <section className={styles.card}>
        <h2>1. Envie o edital oficial</h2>
        <form action={action} className={styles.form}>
          <label className={`${styles.field} ${styles.full}`}>
            <span>PDF do edital (até 30 MB; precisa ter texto — PDF escaneado não funciona)</span>
            <input name="pdf" type="file" accept="application/pdf" required />
          </label>
          <label className={styles.field}>
            <span>Link oficial do edital (https, opcional)</span>
            <input name="noticeUrl" type="url" maxLength={500} placeholder="https://…" />
          </label>
          <label className={styles.field}>
            <span>Atualizar um concurso já cadastrado (opcional)</span>
            <select name="contestId" defaultValue="">
              <option value="">Não — é um concurso novo</option>
              {contests.map((contest) => (
                <option key={contest.id} value={contest.id}>
                  {contest.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Qual IA usar</span>
            <select name="ai" defaultValue={localAvailable || !remoteAvailable ? "local" : "remote"}>
              <option value="local">
                Local — {localModel} (grátis, neste computador){localAvailable ? "" : " — indisponível"}
              </option>
              <option value="remote" disabled={!remoteAvailable}>
                Online (chave do .env){remoteAvailable ? "" : " — não configurada"}
              </option>
            </select>
          </label>
          <div className={styles.full}>
            <ReadButton />
          </div>
        </form>
        {state.status === "error" ? <p className={styles.error}>{state.message}</p> : null}
      </section>

      {state.status === "ok" ? (
        <>
          <section className={styles.card}>
            <h2>2. Revise e salve o concurso</h2>
            <p className={styles.hint}>
              Tudo abaixo foi sugerido pela IA a partir do edital. Confira cada campo com o PDF antes de salvar — ao salvar, as regras
              normais do cadastro valem. Marque “Publicado no site” só depois de revisar.
              {` (IA ${state.usage.provider === "local" ? "local" : "online"}: ${state.usage.seconds} s, ${state.usage.inputTokens.toLocaleString("pt-BR")} tokens lidos.)`}
            </p>
            {state.warnings.length > 0 ? (
              <ul className={styles.error}>
                {state.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
            <ContestForm key={state.key} values={state.values} organizations={organizations} boards={boards} careers={careers} offers={offers} />
          </section>

          {state.news ? (
            <section className={styles.card}>
              <h2>3. Rascunho da notícia</h2>
              <p className={styles.hint}>
                Texto montado a partir dos dados do edital. Ele vira um <strong>rascunho</strong> no Blog (não é publicado daqui): lá você
                revisa, põe a capa e publica.
              </p>
              <form key={`news-${state.key}`} action={createNewsDraftAction} className={styles.form}>
                <input type="hidden" name="stateCode" value={state.values.stateCode ?? ""} />
                <input type="hidden" name="contestId" value={state.values.id ?? ""} />
                <label className={`${styles.field} ${styles.full}`}>
                  <span>Título</span>
                  <input name="title" defaultValue={state.news.title} maxLength={200} required />
                </label>
                <label className={`${styles.field} ${styles.full}`}>
                  <span>Resumo</span>
                  <textarea name="excerpt" defaultValue={state.news.excerpt} rows={2} maxLength={320} />
                </label>
                <label className={`${styles.field} ${styles.full}`}>
                  <span>Texto</span>
                  <textarea name="body" defaultValue={state.news.body} rows={18} maxLength={200000} required />
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
