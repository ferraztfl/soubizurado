"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useTransition } from "react";

import {
  QUESTION_EXPLORER_PAGE_SIZE_COOKIE,
  QUESTION_EXPLORER_PAGE_SIZES,
  QUESTION_EXPLORER_SORT_COOKIE,
} from "@/modules/question-bank/presentation/question-explorer-search-params";

import styles from "./question-results-toolbar.module.css";

type QuestionResultsToolbarProps = Readonly<{
  total: number;
  firstItem: number;
  lastItem: number;
  pageSize: number;
  sort: string;
}>;

const SORTS = [
  { value: "recentes", label: "Mais recentes" },
  { value: "antigas", label: "Mais antigas" },
  { value: "ano", label: "Ano da prova" },
];

const numberFormatter = new Intl.NumberFormat("pt-BR");
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

function savePreference(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${ONE_YEAR_IN_SECONDS}; SameSite=Lax`;
}

/**
 * Count, page size and sort. Changes go to the URL (page 1) and to a cookie,
 * so the choice survives filters, pagination and later visits.
 */
export function QuestionResultsToolbar({ total, firstItem, lastItem, pageSize, sort }: QuestionResultsToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Keep the cookie in step with what is on screen (e.g. a shared link with ?por=50).
  useEffect(() => {
    savePreference(QUESTION_EXPLORER_PAGE_SIZE_COOKIE, String(pageSize));
    savePreference(QUESTION_EXPLORER_SORT_COOKIE, sort);
  }, [pageSize, sort]);

  function update(name: "por" | "ordem", value: string) {
    savePreference(name === "por" ? QUESTION_EXPLORER_PAGE_SIZE_COOKIE : QUESTION_EXPLORER_SORT_COOKIE, value);

    // Always explicit in the URL, so the navigation happens even when the
    // new value equals the default and the old one came from the cookie.
    const params = new URLSearchParams(searchParams.toString());
    params.set(name, value);
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
          <select value={pageSize} onChange={(event) => update("por", event.target.value)} disabled={isPending}>
            {QUESTION_EXPLORER_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.control}>
          <span>Ordenar por</span>
          <select value={sort} onChange={(event) => update("ordem", event.target.value)} disabled={isPending}>
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
