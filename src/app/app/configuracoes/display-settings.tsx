"use client";

import { useState } from "react";

import {
  QUESTION_EXPLORER_PAGE_SIZE_COOKIE,
  QUESTION_EXPLORER_PAGE_SIZES,
  QUESTION_EXPLORER_SORT_COOKIE,
} from "@/modules/question-bank/presentation/question-explorer-search-params";

import { FONT_SCALE_STEPS, savePreferenceCookie } from "../_components/reading-preferences";
import { useReadingPreferences } from "../_components/reading-preferences-context";
import styles from "../perfil/account.module.css";

const SORT_OPTIONS = [
  { value: "recentes", label: "Mais recentes" },
  { value: "antigas", label: "Mais antigas" },
  { value: "ano", label: "Ano da prova" },
] as const;

type DisplaySettingsProps = Readonly<{
  pageSize: number;
  sort: string;
}>;

/** Appearance and question-list defaults, saved as cookies (like the topbar controls). */
export function DisplaySettings({ pageSize: initialPageSize, sort: initialSort }: DisplaySettingsProps) {
  const { theme, fontScale, changeTheme, changeFontScale } = useReadingPreferences();
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sort, setSort] = useState(initialSort);

  return (
    <>
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2>Aparência</h2>
          <p>Vale para todo o app neste navegador. Também dá para mudar pelos botões do topo.</p>
        </div>

        <div className={styles.field}>
          <span>Tema</span>
          <div className={styles.choices} role="group" aria-label="Tema">
            {(
              [
                { value: "light", label: "☀️ Claro" },
                { value: "dark", label: "🌙 Escuro" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                className={theme === option.value ? styles.choiceActive : styles.choice}
                aria-pressed={theme === option.value}
                onClick={() => changeTheme(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <span>Tamanho do texto das questões</span>
          <div className={styles.choices} role="group" aria-label="Tamanho do texto">
            {FONT_SCALE_STEPS.map((step) => (
              <button
                key={step}
                type="button"
                className={fontScale === step ? styles.choiceActive : styles.choice}
                aria-pressed={fontScale === step}
                onClick={() => changeFontScale(step)}
              >
                {step}%
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2>Lista de questões</h2>
          <p>Como o explorador de questões abre por padrão.</p>
        </div>

        <div className={styles.field}>
          <span>Questões por página</span>
          <div className={styles.choices} role="group" aria-label="Questões por página">
            {QUESTION_EXPLORER_PAGE_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                className={pageSize === size ? styles.choiceActive : styles.choice}
                aria-pressed={pageSize === size}
                onClick={() => {
                  setPageSize(size);
                  savePreferenceCookie(QUESTION_EXPLORER_PAGE_SIZE_COOKIE, String(size));
                }}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <span>Ordem</span>
          <div className={styles.choices} role="group" aria-label="Ordem">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={sort === option.value ? styles.choiceActive : styles.choice}
                aria-pressed={sort === option.value}
                onClick={() => {
                  setSort(option.value);
                  savePreferenceCookie(QUESTION_EXPLORER_SORT_COOKIE, option.value);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
