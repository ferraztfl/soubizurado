"use client";

import { useActionState, useState } from "react";

import { SubmitButton } from "@/app/admin/_components/submit-button";

import styles from "../[questionId]/editar/editar.module.css";
import { createQuestionAction, type CreateQuestionState } from "./actions";

type Named = Readonly<{ id: string; name: string }>;

export type TaxonomyOption = Named &
  Readonly<{
    areas: readonly (Named & Readonly<{ topics: readonly Named[] }>)[];
  }>;

const LABELS = ["A", "B", "C", "D", "E"] as const;

const initialState: CreateQuestionState = { error: null };

/** Controlled so the typed text survives a rejected save. */
export function NewQuestionForm({ taxonomy }: Readonly<{ taxonomy: readonly TaxonomyOption[] }>) {
  const [state, formAction] = useActionState(createQuestionAction, initialState);

  const [type, setType] = useState<"MULTIPLE_CHOICE" | "TRUE_FALSE">("MULTIPLE_CHOICE");
  const [statement, setStatement] = useState("");
  const [alternatives, setAlternatives] = useState<Record<string, string>>({});
  const [correctLabel, setCorrectLabel] = useState("");
  const [trueFalse, setTrueFalse] = useState("");
  const [disciplineId, setDisciplineId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [topicId, setTopicId] = useState("");

  const discipline = taxonomy.find((item) => item.id === disciplineId);
  const area = discipline?.areas.find((item) => item.id === areaId);

  return (
    <form action={formAction} className={styles.form}>
      {state.error ? (
        <div className={styles.noticeError} role="alert">
          {state.error}
        </div>
      ) : null}

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
          <h2 className={styles.cardTitle}>Enunciado</h2>
          <p className={styles.hint}>Aceita **negrito**, _itálico_ e quebras de linha.</p>
        </div>
        <label className={styles.srOnly} htmlFor="statement">
          Enunciado
        </label>
        <textarea
          id="statement"
          name="statement"
          className={styles.textarea}
          rows={10}
          value={statement}
          onChange={(event) => setStatement(event.target.value)}
          required
        />
      </section>

      {type === "MULTIPLE_CHOICE" ? (
        <fieldset className={styles.card}>
          <legend className={styles.cardTitle}>Alternativas e gabarito</legend>
          <p className={styles.hint}>Preencha em sequência (pelo menos A e B) e marque a correta.</p>
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
                  <label className={styles.srOnly} htmlFor={`alternative-${label}`}>
                    Texto da alternativa {label}
                  </label>
                  <textarea
                    id={`alternative-${label}`}
                    name={`alternative:${label}`}
                    className={styles.textarea}
                    rows={2}
                    value={alternatives[label] ?? ""}
                    onChange={(event) => setAlternatives((current) => ({ ...current, [label]: event.target.value }))}
                  />
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

        <label className={styles.hint} htmlFor="disciplineId">
          Matéria
        </label>
        <select
          id="disciplineId"
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

        <label className={styles.hint} htmlFor="areaId">
          Tópico
        </label>
        <select
          id="areaId"
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

        <label className={styles.hint} htmlFor="topicId">
          Subtópico
        </label>
        <select
          id="topicId"
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

        <SubmitButton pendingLabel="Criando..." className={styles.primaryButton}>
          Criar questão em revisão
        </SubmitButton>
      </section>
    </form>
  );
}
