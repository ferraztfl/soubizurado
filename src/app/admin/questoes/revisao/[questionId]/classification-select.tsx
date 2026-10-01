"use client";

import { useMemo, useState } from "react";

import styles from "./page.module.css";

type Group = Readonly<{
  label: string;
  options: readonly Readonly<{ value: string; label: string; indent: boolean }>[];
}>;

const SUBTOPIC_PREFIX = "  ↳ ";

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Classification <select> with a search box: the list has hundreds of
 * entries, so typing part of a Tópico, Subtópico or Detalhe narrows it
 * (accents and case ignored). The current choice always stays in the list.
 */
export function ClassificationSelect({ groups, defaultValue }: Readonly<{ groups: readonly Group[]; defaultValue: string }>) {
  const [term, setTerm] = useState("");
  const [value, setValue] = useState(defaultValue);

  const visible = useMemo(() => {
    const words = fold(term).split(/\s+/).filter(Boolean);

    if (words.length === 0) return groups;

    return groups.flatMap((group) => {
      const groupText = fold(group.label);
      const options = group.options.filter((option) => {
        const text = `${groupText} ${fold(option.label)}`;

        return option.value === value || words.every((word) => text.includes(word));
      });

      return options.length > 0 ? [{ ...group, options }] : [];
    });
  }, [groups, term, value]);

  const matches = visible.reduce((total, group) => total + group.options.length, 0);

  return (
    <>
      <label className={styles.field} htmlFor="classification-search">
        <span className={styles.srOnly}>Buscar na classificação</span>
        <input
          id="classification-search"
          type="search"
          className={styles.select}
          placeholder="Buscar tópico, subtópico ou detalhe…"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          autoComplete="off"
        />
      </label>

      <label className={styles.field} htmlFor="classification">
        <span className={styles.srOnly}>Subtópico ou detalhe</span>
        <select
          id="classification"
          name="classification"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className={styles.select}
          required
        >
          <option value="">
            {term ? `${matches} resultado(s) — selecione` : "Selecione um subtópico ou detalhe"}
          </option>
          {visible.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.indent ? SUBTOPIC_PREFIX : ""}
                  {option.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
    </>
  );
}
