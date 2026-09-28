"use client";

import { useActionState, useEffect, useMemo, useState } from "react";

import { SubmitButton } from "@/app/admin/_components/submit-button";

import styles from "../[questionId]/editar/editar.module.css";
import { createQuestionAction, type CreateQuestionState } from "./actions";
import local from "./nova.module.css";

type Named = Readonly<{ id: string; name: string }>;

export type TaxonomyOption = Named &
  Readonly<{
    areas: readonly (Named & Readonly<{ topics: readonly Named[] }>)[];
  }>;

type NewQuestionFormProps = Readonly<{
  taxonomy: readonly TaxonomyOption[];
  boards: readonly Named[];
  organizations: readonly string[];
  careerPositions: readonly string[];
  currentYear: number;
}>;

const LABELS = ["A", "B", "C", "D", "E"] as const;
const MAX_STATEMENT_IMAGES = 6;
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

const initialState: CreateQuestionState = { error: null };

/** Local previews of the chosen files (revoked when they change). */
function usePreviews(files: readonly File[]): string[] {
  const urls = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);

  useEffect(() => () => urls.forEach((url) => URL.revokeObjectURL(url)), [urls]);

  return urls;
}

function AlternativeImage({ label }: Readonly<{ label: string }>) {
  const [files, setFiles] = useState<File[]>([]);
  const [preview] = usePreviews(files);

  return (
    <div className={local.alternativeImage}>
      <label className={local.fileLabel}>
        <span>Imagem (opcional)</span>
        <input
          type="file"
          name={`alternativeImage:${label}`}
          accept={ACCEPT}
          onChange={(event) => setFiles(event.target.files?.[0] ? [event.target.files[0]] : [])}
        />
      </label>
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- local preview (blob URL)
        <img src={preview} alt={`Prévia da imagem da alternativa ${label}`} className={local.preview} />
      ) : null}
    </div>
  );
}

/** Controlled so the typed text survives a rejected save (files must be chosen again). */
export function NewQuestionForm({ taxonomy, boards, organizations, careerPositions, currentYear }: NewQuestionFormProps) {
  const [state, formAction] = useActionState(createQuestionAction, initialState);

  const [kind, setKind] = useState<"EXAM" | "ORIGINAL">("EXAM");
  const [type, setType] = useState<"MULTIPLE_CHOICE" | "TRUE_FALSE">("MULTIPLE_CHOICE");
  const [boardId, setBoardId] = useState("");
  const [year, setYear] = useState("");
  const [organization, setOrganization] = useState("");
  const [careerPosition, setCareerPosition] = useState("");
  const [questionNumber, setQuestionNumber] = useState("");
  const [supportText, setSupportText] = useState("");
  const [statement, setStatement] = useState("");
  const [statementFiles, setStatementFiles] = useState<File[]>([]);
  const [alternatives, setAlternatives] = useState<Record<string, string>>({});
  const [correctLabel, setCorrectLabel] = useState("");
  const [trueFalse, setTrueFalse] = useState("");
  const [disciplineId, setDisciplineId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [topicId, setTopicId] = useState("");

  const statementPreviews = usePreviews(statementFiles);

  // A rejected save resets the file inputs (form action): drop the stale
  // previews and remount the alternative pickers.
  const [fileRound, setFileRound] = useState(0);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.error) {
      setStatementFiles([]);
      setFileRound((round) => round + 1);
    }
  }
  const discipline = taxonomy.find((item) => item.id === disciplineId);
  const area = discipline?.areas.find((item) => item.id === areaId);

  return (
    <form action={formAction} className={styles.form}>
      {state.error ? (
        <div className={styles.noticeError} role="alert">
          {state.error}
          {" "}Se havia imagens, selecione-as de novo.
        </div>
      ) : null}

      <fieldset className={styles.card}>
        <legend className={styles.cardTitle}>Origem</legend>
        <div className={styles.trueFalse}>
          {[
            { value: "EXAM", label: "Questão de prova de concurso" },
            { value: "ORIGINAL", label: "Questão inédita (elaborada por nós)" },
          ].map((option) => (
            <label key={option.value} className={styles.trueFalseOption}>
              <input
                type="radio"
                name="kind"
                value={option.value}
                checked={kind === option.value}
                onChange={() => setKind(option.value as typeof kind)}
              />
              {option.label}
            </label>
          ))}
        </div>

        {kind === "EXAM" ? (
          <div className={local.grid}>
            <label className={local.field}>
              <span>Banca</span>
              <select name="boardId" className={styles.input} value={boardId} onChange={(event) => setBoardId(event.target.value)} required>
                <option value="">Escolha…</option>
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={local.field}>
              <span>Ano</span>
              <input
                name="year"
                type="number"
                min={1990}
                max={currentYear}
                className={styles.input}
                value={year}
                onChange={(event) => setYear(event.target.value)}
                required
              />
            </label>
            <label className={local.field}>
              <span>Órgão</span>
              <input
                name="organization"
                list="organizations"
                maxLength={180}
                className={styles.input}
                placeholder="Ex.: PM PR"
                value={organization}
                onChange={(event) => setOrganization(event.target.value)}
                required
              />
            </label>
            <label className={local.field}>
              <span>Cargo</span>
              <input
                name="careerPosition"
                list="career-positions"
                maxLength={180}
                className={styles.input}
                placeholder="Ex.: Soldado"
                value={careerPosition}
                onChange={(event) => setCareerPosition(event.target.value)}
                required
              />
            </label>
            <label className={local.field}>
              <span>Nº da questão (opcional)</span>
              <input
                name="questionNumber"
                maxLength={20}
                className={styles.input}
                value={questionNumber}
                onChange={(event) => setQuestionNumber(event.target.value)}
              />
            </label>
            <datalist id="organizations">
              {organizations.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <datalist id="career-positions">
              {careerPositions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <p className={`${styles.hint} ${local.full}`}>
              A banca vem do catálogo. Se a prova (banca, ano, órgão e cargo) já existir, a questão entra nela.
            </p>
          </div>
        ) : null}
      </fieldset>

      <fieldset className={styles.card}>
        <legend className={styles.cardTitle}>Tipo</legend>
        <div className={styles.trueFalse}>
          {[
            { value: "MULTIPLE_CHOICE", label: "Múltipla escolha" },
            { value: "TRUE_FALSE", label: "Certo ou errado" },
          ].map((option) => (
            <label key={option.value} className={styles.trueFalseOption}>
              <input
                type="radio"
                name="type"
                value={option.value}
                checked={type === option.value}
                onChange={() => setType(option.value as typeof type)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <section className={styles.card}>
        <div>
          <h2 className={styles.cardTitle}>Texto de apoio (opcional)</h2>
          <p className={styles.hint}>Texto-base compartilhado, quando a prova traz um texto antes das questões.</p>
        </div>
        <textarea
          name="supportText"
          className={styles.textarea}
          rows={6}
          value={supportText}
          onChange={(event) => setSupportText(event.target.value)}
          aria-label="Texto de apoio"
        />
      </section>

      <section className={styles.card}>
        <div>
          <h2 className={styles.cardTitle}>Enunciado</h2>
          <p className={styles.hint}>
            Aceita **negrito**, _itálico_ e quebras de linha. Para pôr uma imagem no meio do texto, escreva{" "}
            <code>[imagem 1]</code>, <code>[imagem 2]</code>…; sem isso, as imagens aparecem após o enunciado.
          </p>
        </div>
        <textarea
          id="statement"
          name="statement"
          className={styles.textarea}
          rows={10}
          value={statement}
          onChange={(event) => setStatement(event.target.value)}
          aria-label="Enunciado"
          required
        />

        <label className={local.fileLabel}>
          <span>
            Imagens do enunciado (até {MAX_STATEMENT_IMAGES}; PNG, JPG, WebP ou GIF até 8 MB). Convertidas
            automaticamente para WebP leve e legível (até 1600px de largura), guardadas no armazenamento de arquivos.
          </span>
          <input
            key={`statement-${fileRound}`}
            type="file"
            name="statementImages"
            accept={ACCEPT}
            multiple
            onChange={(event) => setStatementFiles(Array.from(event.target.files ?? []).slice(0, MAX_STATEMENT_IMAGES))}
          />
        </label>
        {statementPreviews.length > 0 ? (
          <ol className={local.previews}>
            {statementPreviews.map((url, index) => (
              <li key={url}>
                {/* eslint-disable-next-line @next/next/no-img-element -- local preview (blob URL) */}
                <img src={url} alt={`Prévia da imagem ${index + 1}`} className={local.preview} />
                <code>[imagem {index + 1}]</code>
              </li>
            ))}
          </ol>
        ) : null}
      </section>

      {type === "MULTIPLE_CHOICE" ? (
        <fieldset className={styles.card}>
          <legend className={styles.cardTitle}>Alternativas e gabarito</legend>
          <p className={styles.hint}>Preencha em sequência (pelo menos A e B) com texto e/ou imagem e marque a correta.</p>
          <ol className={styles.alternatives}>
            {LABELS.map((label) => (
              <li
                key={label}
                className={`${styles.alternative} ${correctLabel === label ? styles.alternativeCorrect : ""}`}
              >
                <label className={styles.correctChoice}>
                  <input
                    type="radio"
                    name="correctLabel"
                    value={label}
                    checked={correctLabel === label}
                    onChange={() => setCorrectLabel(label)}
                  />
                  <span className={styles.letter}>{label}</span>
                  <span className={styles.srOnly}>Marcar {label} como correta</span>
                </label>
                <div className={styles.alternativeBody}>
                  <textarea
                    name={`alternative:${label}`}
                    className={styles.textarea}
                    rows={2}
                    value={alternatives[label] ?? ""}
                    aria-label={`Texto da alternativa ${label}`}
                    onChange={(event) => setAlternatives((current) => ({ ...current, [label]: event.target.value }))}
                  />
                  <AlternativeImage key={`${label}-${fileRound}`} label={label} />
                  {correctLabel === label ? <span className={styles.correctTag}>Gabarito</span> : null}
                </div>
              </li>
            ))}
          </ol>
        </fieldset>
      ) : (
        <fieldset className={styles.card}>
          <legend className={styles.cardTitle}>Gabarito</legend>
          <div className={styles.trueFalse}>
            {[
              { value: "true", label: "Certo" },
              { value: "false", label: "Errado" },
            ].map((option) => (
              <label key={option.value} className={styles.trueFalseOption}>
                <input
                  type="radio"
                  name="correctTrueFalse"
                  value={option.value}
                  checked={trueFalse === option.value}
                  onChange={() => setTrueFalse(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Classificação</h2>
        <p className={styles.hint}>Só itens do catálogo. O subtópico é necessário para publicar.</p>

        <label className={local.field}>
          <span>Matéria</span>
          <select
            name="disciplineId"
            className={styles.input}
            value={disciplineId}
            onChange={(event) => {
              setDisciplineId(event.target.value);
              setAreaId("");
              setTopicId("");
            }}
            required
          >
            <option value="">Escolha…</option>
            {taxonomy.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className={local.field}>
          <span>Tópico</span>
          <select
            name="areaId"
            className={styles.input}
            value={areaId}
            disabled={!discipline}
            onChange={(event) => {
              setAreaId(event.target.value);
              setTopicId("");
            }}
          >
            <option value="">{discipline ? "Escolha…" : "Escolha a matéria primeiro"}</option>
            {discipline?.areas.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className={local.field}>
          <span>Subtópico</span>
          <select
            name="topicId"
            className={styles.input}
            value={topicId}
            disabled={!area}
            onChange={(event) => setTopicId(event.target.value)}
          >
            <option value="">{area ? "Escolha…" : "Escolha o tópico primeiro"}</option>
            {area?.topics.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <SubmitButton pendingLabel="Criando..." className={styles.primaryButton}>
          Criar questão em revisão
        </SubmitButton>
      </section>
    </form>
  );
}
