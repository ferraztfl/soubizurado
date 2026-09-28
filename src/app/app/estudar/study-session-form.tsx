"use client";

import { useState } from "react";

import { createStudySessionAction } from "@/modules/study/presentation/actions/study-session-actions";

import styles from "./estudar.module.css";

type Named = Readonly<{ id: string; name: string }>;

export type StudyDisciplineOption = Named & Readonly<{ areas: readonly Named[] }>;

const MODES = [
  { value: "MIXED", label: "Misto", hint: "Revisões pendentes + questões novas" },
  { value: "NEW", label: "Só novas", hint: "Questões que você ainda não respondeu" },
  { value: "REVIEW", label: "Só revisão", hint: "Questões que você errou e que venceram hoje" },
] as const;

const SIZES = [5, 10, 20, 30] as const;

export function StudySessionForm({ disciplines }: Readonly<{ disciplines: readonly StudyDisciplineOption[] }>) {
  const [disciplineId, setDisciplineId] = useState("");
  const [mode, setMode] = useState<(typeof MODES)[number]["value"]>("MIXED");
  const [size, setSize] = useState<number>(10);
  const discipline = disciplines.find((item) => item.id === disciplineId);

  return (
    <form action={createStudySessionAction} className={styles.form}>
      <fieldset className={styles.fieldset}>
        <legend>O que estudar</legend>
        <div className={styles.grid}>
          <label className={styles.field}>
            <span>Matéria</span>
            <select name="disciplineId" value={disciplineId} onChange={(event) => setDisciplineId(event.target.value)}>
              <option value="">Todas as matérias</option>
              {disciplines.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Tópico (opcional)</span>
            <select name="areaId" disabled={!discipline} key={disciplineId} defaultValue="">
              <option value="">{discipline ? "Todos os tópicos" : "Escolha a matéria primeiro"}</option>
              {discipline?.areas.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Modo</legend>
        <div className={styles.modes}>
          {MODES.map((option) => (
            <label key={option.value} className={mode === option.value ? styles.modeActive : styles.mode}>
              <input type="radio" name="mode" value={option.value} checked={mode === option.value} onChange={() => setMode(option.value)} />
              <strong>{option.label}</strong>
              <span>{option.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Quantidade</legend>
        <div className={styles.sizes}>
          {SIZES.map((value) => (
            <label key={value} className={size === value ? styles.sizeActive : styles.size}>
              <input type="radio" name="size" value={value} checked={size === value} onChange={() => setSize(value)} />
              {value} questões
            </label>
          ))}
        </div>
      </fieldset>

      <button type="submit" className={styles.primary}>
        Começar a estudar
      </button>
    </form>
  );
}
