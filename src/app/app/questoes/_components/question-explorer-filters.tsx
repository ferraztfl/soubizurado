import Link from "next/link";

import type {
  QuestionExplorerFacets,
} from "@/modules/question-bank/application/ports/public-question-read-repository";
import type {
  QuestionExplorerQuery,
} from "@/modules/question-bank/presentation/question-explorer-search-params";

import styles from "./question-explorer-filters.module.css";

type QuestionExplorerFiltersProps = Readonly<{
  facets: QuestionExplorerFacets;
  query: QuestionExplorerQuery;
}>;

export function QuestionExplorerFilters({
  facets,
  query,
}: QuestionExplorerFiltersProps) {
  const filters = query.filters;

  return (
    <form
      action="/app/questoes"
      method="get"
      className={styles.filters}
    >
      <div className={styles.searchField}>
        <label htmlFor="question-search">
          Buscar no enunciado
        </label>
        <input
          id="question-search"
          name="q"
          type="search"
          maxLength={120}
          defaultValue={filters.search ?? ""}
          placeholder="Ex.: direitos fundamentais"
        />
      </div>

      <div className={styles.selectField}>
        <label htmlFor="question-discipline">
          Disciplina
        </label>
        <select
          id="question-discipline"
          name="discipline"
          defaultValue={
            filters.disciplineId ?? ""
          }
        >
          <option value="">
            Todas as disciplinas
          </option>
          {facets.disciplines.map(
            (discipline) => (
              <option
                key={discipline.id}
                value={discipline.id}
              >
                {discipline.name}
              </option>
            ),
          )}
        </select>
      </div>

      <div className={styles.selectField}>
        <label htmlFor="question-board">
          Banca
        </label>
        <select
          id="question-board"
          name="board"
          defaultValue={filters.boardId ?? ""}
        >
          <option value="">Todas as bancas</option>
          {facets.boards.map((board) => (
            <option
              key={board.id}
              value={board.id}
            >
              {board.acronym
                ? `${board.acronym} — ${board.name}`
                : board.name}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.selectField}>
        <label htmlFor="question-year">
          Ano
        </label>
        <select
          id="question-year"
          name="year"
          defaultValue={
            filters.year !== undefined
              ? String(filters.year)
              : ""
          }
        >
          <option value="">Todos os anos</option>
          {facets.years.map((year) => (
            <option
              key={year}
              value={year}
            >
              {year}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.selectField}>
        <label htmlFor="question-type">
          Tipo
        </label>
        <select
          id="question-type"
          name="type"
          defaultValue={filters.type ?? ""}
        >
          <option value="">Todos os tipos</option>
          {facets.types.map((type) => (
            <option
              key={type}
              value={type}
            >
              {type === "MULTIPLE_CHOICE"
                ? "Múltipla escolha"
                : "Certo / Errado"}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.actions}>
        <button
          type="submit"
          className={styles.submit}
        >
          Aplicar filtros
        </button>

        <Link
          href="/app/questoes"
          className={styles.clear}
        >
          Limpar
        </Link>
      </div>
    </form>
  );
}
