import Link from "next/link";

import type { Prisma } from "@/generated/prisma/client";
import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { formatQuestionCode, parseQuestionCode } from "@/modules/question-bank/domain/question-code";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import styles from "./questoes.module.css";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const MIN_TEXT_SEARCH = 4;

const STATUSES = [
  { value: "IN_REVIEW", label: "Em revisão" },
  { value: "PUBLISHED", label: "Publicadas" },
  { value: "DRAFT", label: "Rascunhos" },
  { value: "ARCHIVED", label: "Arquivadas" },
] as const;

type Status = (typeof STATUSES)[number]["value"];

const STATUS_LABEL: Record<Status, string> = {
  IN_REVIEW: "Em revisão",
  PUBLISHED: "Publicada",
  DRAFT: "Rascunho",
  ARCHIVED: "Arquivada",
};

type SearchParams = Readonly<{
  busca?: string;
  situacao?: string;
  materia?: string;
  banca?: string;
  ano?: string;
  antes?: string;
}>;

type AllQuestionsPageProps = Readonly<{
  searchParams: Promise<SearchParams>;
}>;

const UUID = /^[0-9a-f-]{36}$/i;

function readFilters(params: SearchParams) {
  const search = params.busca?.trim().slice(0, 200) ?? "";
  const year = Number(params.ano);
  const before = Number(params.antes);

  return {
    search,
    status: STATUSES.find((item) => item.value === params.situacao)?.value ?? null,
    disciplineId: params.materia && UUID.test(params.materia) ? params.materia : null,
    boardId: params.banca && UUID.test(params.banca) ? params.banca : null,
    year: Number.isSafeInteger(year) && year >= 1990 && year <= 2100 ? year : null,
    before: Number.isSafeInteger(before) && before > 0 ? before : null,
  };
}

type Filters = ReturnType<typeof readFilters>;

function buildHref(filters: Filters, changes: Partial<Record<keyof SearchParams, string | null>>): string {
  const values: Record<keyof SearchParams, string | null> = {
    busca: filters.search || null,
    situacao: filters.status,
    materia: filters.disciplineId,
    banca: filters.boardId,
    ano: filters.year ? String(filters.year) : null,
    antes: null,
    ...changes,
  };
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value) query.set(key, value);
  }

  const text = query.toString();
  return text ? `/admin/questoes?${text}` : "/admin/questoes";
}

export default async function AllQuestionsPage(props: AllQuestionsPageProps) {
  await requireAdminUser();

  const filters = readFilters(await props.searchParams);
  const prisma = getPrismaClient();
  const code = parseQuestionCode(filters.search);
  const textSearch = code === null && filters.search.length >= MIN_TEXT_SEARCH ? filters.search : null;

  // Everything except the status: the tabs show how the other filters split.
  const base: Prisma.QuestionWhereInput = {
    ...(code !== null ? { publicNumber: code } : {}),
    ...(textSearch ? { statement: { contains: textSearch, mode: "insensitive" } } : {}),
    ...(filters.disciplineId ? { disciplineId: filters.disciplineId } : {}),
    ...(filters.boardId || filters.year
      ? {
          examination: {
            ...(filters.boardId ? { boardId: filters.boardId } : {}),
            ...(filters.year ? { year: filters.year } : {}),
          },
        }
      : {}),
  };

  const [questions, counts, disciplines, boards] = await Promise.all([
    prisma.question.findMany({
      where: {
        ...base,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.before && code === null ? { publicNumber: { lt: filters.before } } : {}),
      },
      // Keyset pagination by the public number: constant cost at any depth.
      orderBy: { publicNumber: "desc" },
      take: PAGE_SIZE + 1,
      select: {
        id: true,
        publicNumber: true,
        status: true,
        statement: true,
        discipline: { select: { name: true } },
        area: { select: { name: true } },
        topic: { select: { name: true } },
        examination: { select: { title: true, year: true, board: { select: { name: true } } } },
      },
    }),
    prisma.question.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
    prisma.discipline.findMany({
      where: { isActive: true, knowledgeAreaId: { not: null } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.examiningBoard.findMany({
      where: { isActive: true, examinations: { some: {} } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const page = questions.slice(0, PAGE_SIZE);
  const next = questions.length > PAGE_SIZE ? page[page.length - 1]?.publicNumber : undefined;
  const countOf = (value: Status | null) =>
    counts
      .filter((row) => value === null || row.status === value)
      .reduce((sum, row) => sum + row._count._all, 0);
  const number = new Intl.NumberFormat("pt-BR");

  return (
    <main className={styles.page}>
      <header>
        <p className={styles.eyebrow}>Banco de questões</p>
        <h1 className={styles.title}>Todas as questões</h1>
        <p className={styles.description}>
          Busque por código (Q100001) ou por um trecho do enunciado e filtre por situação, matéria, banca e ano. A
          edição fica registrada no histórico de revisões.
        </p>
      </header>

      <form className={styles.filters} action="/admin/questoes" role="search">
        <label className={styles.searchField}>
          <span>Busca</span>
          <input
            name="busca"
            defaultValue={filters.search}
            placeholder="Q100001 ou trecho do enunciado"
            maxLength={200}
            autoComplete="off"
          />
        </label>
        <label>
          <span>Matéria</span>
          <select name="materia" defaultValue={filters.disciplineId ?? ""}>
            <option value="">Todas</option>
            {disciplines.map((discipline) => (
              <option key={discipline.id} value={discipline.id}>
                {discipline.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Banca</span>
          <select name="banca" defaultValue={filters.boardId ?? ""}>
            <option value="">Todas</option>
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.yearField}>
          <span>Ano</span>
          <input name="ano" type="number" min={1990} max={2100} defaultValue={filters.year ?? ""} />
        </label>
        {filters.status ? <input type="hidden" name="situacao" value={filters.status} /> : null}
        <div className={styles.filterActions}>
          <button type="submit">Filtrar</button>
          <Link href="/admin/questoes">Limpar</Link>
        </div>
      </form>

      {code === null && filters.search.length > 0 && filters.search.length < MIN_TEXT_SEARCH ? (
        <p className={styles.hint}>Digite pelo menos {MIN_TEXT_SEARCH} caracteres para buscar no enunciado.</p>
      ) : null}

      <nav className={styles.tabs} aria-label="Situação">
        <Link
          href={buildHref(filters, { situacao: null })}
          className={filters.status === null ? styles.tabActive : styles.tab}
          aria-current={filters.status === null ? "page" : undefined}
        >
          Todas <span>{number.format(countOf(null))}</span>
        </Link>
        {STATUSES.map((item) => (
          <Link
            key={item.value}
            href={buildHref(filters, { situacao: item.value })}
            className={item.value === filters.status ? styles.tabActive : styles.tab}
            aria-current={item.value === filters.status ? "page" : undefined}
          >
            {item.label} <span>{number.format(countOf(item.value))}</span>
          </Link>
        ))}
      </nav>

      {page.length === 0 ? (
        <p className={styles.empty}>Nenhuma questão encontrada com esses filtros.</p>
      ) : (
        <ol className={styles.list}>
          {page.map((question) => {
            const questionCode = formatQuestionCode(question.publicNumber);
            const taxonomy = [question.discipline?.name, question.area?.name, question.topic?.name].filter(Boolean);

            return (
              <li key={question.id} className={styles.item}>
                <div className={styles.itemHead}>
                  <strong className={styles.code}>{questionCode}</strong>
                  <span className={styles[`status${question.status}`]}>{STATUS_LABEL[question.status]}</span>
                  <span className={styles.meta}>
                    {taxonomy.length > 0 ? taxonomy.join(" › ") : "Sem classificação"}
                  </span>
                </div>
                {question.examination ? (
                  <p className={styles.meta}>
                    {question.examination.title}
                    {question.examination.board ? ` · ${question.examination.board.name}` : ""}
                  </p>
                ) : null}
                <p className={styles.statement}>
                  {question.statement.length > 240 ? `${question.statement.slice(0, 240)}…` : question.statement}
                </p>
                <div className={styles.links}>
                  <Link href={`/admin/questoes/${question.id}/editar`}>Editar</Link>
                  {question.status === "IN_REVIEW" ? (
                    <Link href={`/admin/questoes/revisao/${question.id}`}>Revisar</Link>
                  ) : null}
                  {question.status === "PUBLISHED" ? (
                    <Link href={`/app/questoes/${questionCode}`} target="_blank" rel="noreferrer">
                      Ver como aluno
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <nav className={styles.pager} aria-label="Paginação">
        {filters.before ? <Link href={buildHref(filters, {})}>« Mais recentes</Link> : <span />}
        {next ? <Link href={buildHref(filters, { antes: String(next) })}>Próximas »</Link> : null}
      </nav>
    </main>
  );
}
