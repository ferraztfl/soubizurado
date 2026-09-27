"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import type { QuestionExplorerFacets } from "@/modules/question-bank/application/ports/public-question-read-repository";
import type { QuestionType } from "@/modules/question-bank/domain/question-type";
import {
  buildQuestionExplorerHref,
  type QuestionExplorerFilters as Filters,
  type QuestionExplorerQuery,
  type QuestionExplorerSituation,
} from "@/modules/question-bank/presentation/question-explorer-search-params";

import styles from "./question-explorer-filters.module.css";

type QuestionExplorerFiltersProps = Readonly<{
  facets: QuestionExplorerFacets;
  query: QuestionExplorerQuery;
}>;

const SITUATIONS: ReadonlyArray<{ value: QuestionExplorerSituation | ""; label: string }> = [
  { value: "", label: "Todas" },
  { value: "nao-resolvidas", label: "Não resolvidas" },
  { value: "erradas", label: "Que já errei" },
  { value: "acertadas", label: "Que já acertei" },
];

const TYPE_LABELS: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: "Múltipla escolha",
  TRUE_FALSE: "Certo / Errado",
};

function withAcronym(item: { name: string; acronym: string | null }): string {
  return item.acronym && item.acronym !== item.name ? `${item.acronym} — ${item.name}` : item.name;
}

/** Drops empty values so the URL only carries what is set. */
function compact(filters: Filters): Filters {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== ""),
  ) as Filters;
}

/**
 * Explorer filters: search, Matéria → Tópico → Subtópico cascade, exam facts
 * and "Minhas questões". Page size and sort are not in the form; they come
 * from the student's saved preference.
 */
export function QuestionExplorerFilters({ facets, query }: QuestionExplorerFiltersProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Filters>(query.filters);
  const [expanded, setExpanded] = useState(false);
  const applied = query.filters;

  const areas = facets.areas.filter((area) => area.disciplineId === draft.disciplineId);
  const topics = facets.topics.filter((topic) => topic.areaId === draft.areaId);

  function set<K extends keyof Filters>(name: K, value: Filters[K]) {
    setDraft((current) => {
      const next = { ...current, [name]: value };

      // Keep the cascade consistent.
      if (name === "disciplineId") {
        next.areaId = undefined;
        next.topicId = undefined;
      }

      if (name === "areaId") {
        next.topicId = undefined;
      }

      return next;
    });
  }

  function navigate(filters: Filters) {
    startTransition(() => {
      router.push(buildQuestionExplorerHref(compact(filters)));
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ ...draft, search: draft.search?.trim() || undefined });
  }

  function chooseSituation(value: QuestionExplorerSituation | "") {
    const situation = value || undefined;
    setDraft((current) => ({ ...current, situation }));
    // One click is enough for "Minhas questões"; keeps the other applied filters.
    navigate({ ...applied, situation });
  }

  const chips = buildActiveChips(applied, facets);

  return (
    <section className={styles.panel} aria-label="Filtros" aria-busy={isPending}>
      {/* Phones only: the form starts collapsed so the questions show up first. */}
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={expanded}
        aria-controls="question-filters-form"
        onClick={() => setExpanded((current) => !current)}
      >
        <span>
          Filtros{chips.length > 0 ? <span className={styles.toggleCount}>{chips.length}</span> : null}
        </span>
        <span aria-hidden="true">{expanded ? "▴" : "▾"}</span>
      </button>

      <form
        id="question-filters-form"
        action="/app/questoes"
        method="get"
        className={`${styles.filters} ${expanded ? styles.filtersExpanded : ""}`}
        onSubmit={submit}
      >
        <div className={`${styles.field} ${styles.search}`}>
          <label htmlFor="question-search">Buscar no enunciado ou código</label>
          <input
            id="question-search"
            name="q"
            type="search"
            maxLength={120}
            value={draft.search ?? ""}
            onChange={(event) => set("search", event.target.value)}
            placeholder="Ex.: direitos fundamentais ou Q100231"
          />
        </div>

        <fieldset className={`${styles.field} ${styles.situation}`}>
          <legend>Minhas questões</legend>
          <div className={styles.segmented}>
            {SITUATIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={(applied.situation ?? "") === option.value ? styles.segmentActive : styles.segment}
                aria-pressed={(applied.situation ?? "") === option.value}
                onClick={() => chooseSituation(option.value)}
                disabled={isPending}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className={styles.field}>
          <label htmlFor="question-discipline">Matéria</label>
          <select
            id="question-discipline"
            name="discipline"
            value={draft.disciplineId ?? ""}
            onChange={(event) => set("disciplineId", event.target.value || undefined)}
          >
            <option value="">Todas as matérias</option>
            {facets.disciplines.map((discipline) => (
              <option key={discipline.id} value={discipline.id}>
                {discipline.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="question-area">Tópico</label>
          <select
            id="question-area"
            name="area"
            value={draft.areaId ?? ""}
            onChange={(event) => set("areaId", event.target.value || undefined)}
            disabled={areas.length === 0}
          >
            <option value="">{draft.disciplineId ? "Todos os tópicos" : "Escolha a matéria"}</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="question-topic">Subtópico</label>
          <select
            id="question-topic"
            name="topic"
            value={draft.topicId ?? ""}
            onChange={(event) => set("topicId", event.target.value || undefined)}
            disabled={topics.length === 0}
          >
            <option value="">{draft.areaId ? "Todos os subtópicos" : "Escolha o tópico"}</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="question-board">Banca</label>
          <select
            id="question-board"
            name="board"
            value={draft.boardId ?? ""}
            onChange={(event) => set("boardId", event.target.value || undefined)}
          >
            <option value="">Todas as bancas</option>
            {facets.boards.map((board) => (
              <option key={board.id} value={board.id}>
                {withAcronym(board)}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="question-organization">Órgão</label>
          <select
            id="question-organization"
            name="org"
            value={draft.organizationId ?? ""}
            onChange={(event) => set("organizationId", event.target.value || undefined)}
          >
            <option value="">Todos os órgãos</option>
            {facets.organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {withAcronym(organization)}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="question-career">Cargo</label>
          <select
            id="question-career"
            name="cargo"
            value={draft.careerPositionId ?? ""}
            onChange={(event) => set("careerPositionId", event.target.value || undefined)}
          >
            <option value="">Todos os cargos</option>
            {facets.careerPositions.map((career) => (
              <option key={career.id} value={career.id}>
                {career.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="question-year">Ano</label>
          <select
            id="question-year"
            name="year"
            value={draft.year !== undefined ? String(draft.year) : ""}
            onChange={(event) => set("year", event.target.value ? Number(event.target.value) : undefined)}
          >
            <option value="">Todos os anos</option>
            {facets.years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="question-type">Tipo</label>
          <select
            id="question-type"
            name="type"
            value={draft.type ?? ""}
            onChange={(event) => set("type", (event.target.value || undefined) as QuestionType | undefined)}
          >
            <option value="">Todos os tipos</option>
            {facets.types.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.actions}>
          <button type="submit" className={styles.submit} disabled={isPending}>
            {isPending ? "Filtrando…" : "Filtrar"}
          </button>
          <Link href="/app/questoes" className={styles.clear}>
            Limpar
          </Link>
        </div>
      </form>

      {chips.length > 0 ? (
        <ul className={styles.chips} aria-label="Filtros aplicados">
          {chips.map((chip) => (
            <li key={chip.key}>
              <Link
                href={buildQuestionExplorerHref(compact({ ...applied, ...chip.remove }))}
                className={styles.chip}
                aria-label={`Remover filtro ${chip.label}`}
              >
                <span className={styles.chipKind}>{chip.kind}:</span> {chip.label}
                <span className={styles.chipRemove} aria-hidden="true">
                  ×
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

type ActiveChip = Readonly<{
  key: string;
  kind: string;
  label: string;
  /** Filters to clear when the chip is removed (cascade included). */
  remove: Partial<Filters>;
}>;

function buildActiveChips(filters: Filters, facets: QuestionExplorerFacets): ActiveChip[] {
  const nameOf = (list: ReadonlyArray<{ id: string; name: string }>, id: string | undefined) =>
    list.find((item) => item.id === id)?.name ?? "—";
  const chips: ActiveChip[] = [];

  if (filters.search) {
    chips.push({ key: "q", kind: "Busca", label: `“${filters.search}”`, remove: { search: undefined } });
  }

  if (filters.situation) {
    chips.push({
      key: "situacao",
      kind: "Minhas questões",
      label: SITUATIONS.find((option) => option.value === filters.situation)?.label ?? filters.situation,
      remove: { situation: undefined },
    });
  }

  if (filters.disciplineId) {
    chips.push({
      key: "discipline",
      kind: "Matéria",
      label: nameOf(facets.disciplines, filters.disciplineId),
      remove: { disciplineId: undefined, areaId: undefined, topicId: undefined },
    });
  }

  if (filters.areaId) {
    chips.push({
      key: "area",
      kind: "Tópico",
      label: nameOf(facets.areas, filters.areaId),
      remove: { areaId: undefined, topicId: undefined },
    });
  }

  if (filters.topicId) {
    chips.push({ key: "topic", kind: "Subtópico", label: nameOf(facets.topics, filters.topicId), remove: { topicId: undefined } });
  }

  if (filters.boardId) {
    const board = facets.boards.find((item) => item.id === filters.boardId);
    chips.push({ key: "board", kind: "Banca", label: board ? withAcronym(board) : "—", remove: { boardId: undefined } });
  }

  if (filters.organizationId) {
    const organization = facets.organizations.find((item) => item.id === filters.organizationId);
    chips.push({
      key: "org",
      kind: "Órgão",
      label: organization ? withAcronym(organization) : "—",
      remove: { organizationId: undefined },
    });
  }

  if (filters.careerPositionId) {
    chips.push({
      key: "cargo",
      kind: "Cargo",
      label: nameOf(facets.careerPositions, filters.careerPositionId),
      remove: { careerPositionId: undefined },
    });
  }

  if (filters.year !== undefined) {
    chips.push({ key: "year", kind: "Ano", label: String(filters.year), remove: { year: undefined } });
  }

  if (filters.type) {
    chips.push({ key: "type", kind: "Tipo", label: TYPE_LABELS[filters.type], remove: { type: undefined } });
  }

  return chips;
}
