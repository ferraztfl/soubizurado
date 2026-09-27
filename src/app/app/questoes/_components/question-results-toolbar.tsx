"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import styles from "./question-results-toolbar.module.css";

type QuestionResultsToolbarProps = Readonly<{
  total: number;
  firstItem: number;
  lastItem: number;
  pageSize: number;
  sort: string;
}>;

const PAGE_SIZES = [10, 20, 50];
const SORTS = [
  { value: "recentes", label: "Mais recentes" },
  { value: "antigas", label: "Mais antigas" },
  { value: "ano", label: "Ano da prova" },
];

const numberFormatter = new Intl.NumberFormat("pt-BR");

/** Count, page size and sort; changes go straight to the URL (page 1). */
export function QuestionResultsToolbar({ total, firstItem, lastItem, pageSize, sort }: QuestionResultsToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function update(name: "por" | "ordem", value: string, defaultValue: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (value === defaultValue) {
      params.delete(name);
    } else {
      params.set(name, value);
    }

    params.delete("page");
    const query = params.toString();

    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  return (
    <div className={styles.toolbar} aria-busy={isPending}>
      <p className={styles.count}>
        <strong>{numberFormatter.format(total)}</strong> {total === 1 ? "questão encontrada" : "questões encontradas"}
        {total > 0 ? (
          <span className={styles.range}>
            {" "}
            · exibindo {firstItem}–{lastItem}
          </span>
        ) : null}
      </p>

      <div className={styles.controls}>
        <label className={styles.control}>
          <span>Questões por página</span>
          <select value={pageSize} onChange={(event) => update("por", event.target.value, "10")} disabled={isPending}>
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.control}>
          <span>Ordenar por</span>
          <select value={sort} onChange={(event) => update("ordem", event.target.value, "recentes")} disabled={isPending}>
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
