"use client";

import { useState, useTransition, type FormEvent } from "react";

import {
  QUESTION_ERROR_DETAILS_MAX_LENGTH,
  QUESTION_ERROR_REASONS,
  QUESTION_NOTE_MAX_LENGTH,
  type QuestionErrorReason,
} from "@/modules/study/domain/question-error-report";
import type { QuestionStudyToolsState } from "@/modules/study/infrastructure/queries/question-study-tools";
import {
  reportQuestionErrorAction,
  saveQuestionNoteAction,
  setQuestionFavoriteAction,
} from "@/modules/study/presentation/actions/question-study-tools-actions";

import styles from "./question-study-tools.module.css";

type QuestionStudyToolsProps = Readonly<{
  questionId: string;
  code: string;
  initial: QuestionStudyToolsState;
}>;

type OpenPanel = "note" | "report" | null;

/** Favoritar, Anotação and Reportar erro under a question. */
export function QuestionStudyTools({ questionId, code, initial }: QuestionStudyToolsProps) {
  const [favorite, setFavorite] = useState(initial.favorite);
  const [note, setNote] = useState(initial.note);
  const [draftNote, setDraftNote] = useState(initial.note ?? "");
  const [reported, setReported] = useState(initial.hasOpenReport);
  const [reason, setReason] = useState<QuestionErrorReason | "">("");
  const [details, setDetails] = useState("");
  const [open, setOpen] = useState<OpenPanel>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(panel: Exclude<OpenPanel, null>) {
    setMessage(null);
    setOpen((current) => (current === panel ? null : panel));
  }

  function toggleFavorite() {
    const next = !favorite;
    setFavorite(next);
    setMessage(null);

    startTransition(async () => {
      const result = await setQuestionFavoriteAction(questionId, next);

      if (!result.ok) {
        setFavorite(!next);
        setMessage({ tone: "error", text: result.message });
      }
    });
  }

  function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await saveQuestionNoteAction(questionId, draftNote);

      if (!result.ok) {
        setMessage({ tone: "error", text: result.message });
        return;
      }

      setNote(result.data.note);
      setDraftNote(result.data.note ?? "");
      setMessage({ tone: "ok", text: result.data.note ? "Anotação salva." : "Anotação removida." });
    });
  }

  function sendReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await reportQuestionErrorAction(questionId, reason, details);

      if (!result.ok) {
        setMessage({ tone: "error", text: result.message });
        return;
      }

      setReported(true);
      setReason("");
      setDetails("");
      setOpen(null);
      setMessage({ tone: "ok", text: "Obrigado! Vamos analisar o reporte desta questão." });
    });
  }

  const noteId = `note-${code}`;
  const reportId = `report-${code}`;

  return (
    <div className={styles.tools}>
      <div className={styles.bar} role="group" aria-label={`Ferramentas da questão ${code}`}>
        <button
          type="button"
          className={favorite ? styles.toolActive : styles.tool}
          aria-pressed={favorite}
          onClick={toggleFavorite}
          disabled={isPending}
        >
          <span aria-hidden="true">{favorite ? "★" : "☆"}</span>
          {favorite ? "Favorita" : "Favoritar"}
        </button>

        <button
          type="button"
          className={open === "note" || note ? styles.toolActive : styles.tool}
          aria-expanded={open === "note"}
          aria-controls={noteId}
          onClick={() => toggle("note")}
        >
          <span aria-hidden="true">✎</span>
          {note ? "Minha anotação" : "Anotar"}
        </button>

        <button
          type="button"
          className={open === "report" ? styles.toolActive : styles.tool}
          aria-expanded={open === "report"}
          aria-controls={reportId}
          onClick={() => toggle("report")}
          disabled={reported}
          title={reported ? "Seu reporte está em análise" : undefined}
        >
          <span aria-hidden="true">⚑</span>
          {reported ? "Reporte em análise" : "Reportar erro"}
        </button>
      </div>

      {open === "note" ? (
        <form id={noteId} className={styles.panel} onSubmit={saveNote}>
          <label htmlFor={`${noteId}-text`}>Anotação (só você vê)</label>
          <textarea
            id={`${noteId}-text`}
            rows={4}
            maxLength={QUESTION_NOTE_MAX_LENGTH}
            value={draftNote}
            onChange={(event) => setDraftNote(event.target.value)}
            placeholder="Ex.: lembrar que o art. 5º, LXIX trata do mandado de segurança."
          />
          <div className={styles.panelActions}>
            <span className={styles.counter}>
              {draftNote.length}/{QUESTION_NOTE_MAX_LENGTH}
            </span>
            {note ? (
              <button
                type="button"
                className={styles.secondary}
                onClick={() => setDraftNote("")}
                disabled={isPending}
              >
                Apagar
              </button>
            ) : null}
            <button type="submit" className={styles.primary} disabled={isPending}>
              {isPending ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>
      ) : null}

      {open === "report" && !reported ? (
        <form id={reportId} className={styles.panel} onSubmit={sendReport}>
          <label htmlFor={`${reportId}-reason`}>Qual é o problema?</label>
          <select
            id={`${reportId}-reason`}
            value={reason}
            onChange={(event) => setReason(event.target.value as QuestionErrorReason | "")}
            required
          >
            <option value="">Escolha…</option>
            {Object.entries(QUESTION_ERROR_REASONS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <label htmlFor={`${reportId}-details`}>Detalhes (opcional)</label>
          <textarea
            id={`${reportId}-details`}
            rows={3}
            maxLength={QUESTION_ERROR_DETAILS_MAX_LENGTH}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="Ex.: o gabarito oficial definitivo é a letra C."
          />
          <div className={styles.panelActions}>
            <button type="button" className={styles.secondary} onClick={() => setOpen(null)}>
              Cancelar
            </button>
            <button type="submit" className={styles.primary} disabled={isPending || reason === ""}>
              {isPending ? "Enviando…" : "Enviar reporte"}
            </button>
          </div>
        </form>
      ) : null}

      {message ? (
        <p className={message.tone === "ok" ? styles.ok : styles.error} role={message.tone === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
