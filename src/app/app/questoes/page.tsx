import Link from "next/link";
import { redirect } from "next/navigation";

import {
  createListPublishedQuestionsUseCase,
  createListQuestionExplorerFacetsUseCase,
} from "@/modules/question-bank/infrastructure/composition/question-bank-application";
import {
  buildQuestionExplorerHref,
  parseQuestionExplorerSearchParams,
  type QuestionExplorerRawSearchParams,
} from "@/modules/question-bank/presentation/question-explorer-search-params";
import { EmptyState } from "@/shared/ui/empty-state";
import { PageHeader } from "@/shared/ui/page-header";

import { QuestionExplorerFilters } from "./_components/question-explorer-filters";
import { QuestionPreviewCard } from "./_components/question-preview-card";

import styles from "./question-explorer.module.css";

type QuestionExplorerPageProps = Readonly<{
  searchParams: Promise<QuestionExplorerRawSearchParams>;
}>;

export default async function QuestionExplorerPage({
  searchParams,
}: QuestionExplorerPageProps) {
  const rawSearchParams = await searchParams;
  const query =
    parseQuestionExplorerSearchParams(
      rawSearchParams,
    );

  const listQuestions =
    createListPublishedQuestionsUseCase();
  const listFacets =
    createListQuestionExplorerFacetsUseCase();

  const [result, facets] = await Promise.all([
    listQuestions.execute(query),
    listFacets.execute(),
  ]);

  if (
    result.totalPages > 0 &&
    result.page > result.totalPages
  ) {
    redirect(
      buildQuestionExplorerHref({
        ...query.filters,
        page: result.totalPages,
      }),
    );
  }

  const firstItem =
    result.total === 0
      ? 0
      : (result.page - 1) * result.pageSize + 1;
  const lastItem = Math.min(
    result.page * result.pageSize,
    result.total,
  );

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Banco de questões"
        title="Explorar questões"
        description="Encontre questões publicadas por disciplina, banca, ano e tipo sem expor o gabarito antes da resolução."
      />

      <QuestionExplorerFilters
        facets={facets}
        query={query}
      />

      <section
        className={styles.results}
        aria-labelledby="question-results-title"
      >
        <header className={styles.resultsHeader}>
          <div>
            <span className={styles.resultsEyebrow}>
              Resultados
            </span>
            <h2 id="question-results-title">
              {result.total === 1
                ? "1 questão encontrada"
                : `${result.total} questões encontradas`}
            </h2>
          </div>

          {result.total > 0 ? (
            <span className={styles.range}>
              {firstItem}–{lastItem} de {result.total}
            </span>
          ) : null}
        </header>

        {result.items.length === 0 ? (
          <div className={styles.emptyCard}>
            <EmptyState
              icon="?"
              title="Nenhuma questão encontrada"
              description="Ajuste os filtros ou limpe a busca para consultar outras questões publicadas."
            />
          </div>
        ) : (
          <div className={styles.grid}>
            {result.items.map((question) => (
              <QuestionPreviewCard
                key={question.id}
                question={question}
              />
            ))}
          </div>
        )}

        {result.totalPages > 1 ? (
          <nav
            className={styles.pagination}
            aria-label="Paginação das questões"
          >
            {result.page > 1 ? (
              <Link
                href={buildQuestionExplorerHref({
                  ...query.filters,
                  page: result.page - 1,
                })}
                className={styles.pageLink}
              >
                Anterior
              </Link>
            ) : (
              <span
                className={styles.pageDisabled}
                aria-disabled="true"
              >
                Anterior
              </span>
            )}

            <span className={styles.pageStatus}>
              Página {result.page} de{" "}
              {result.totalPages}
            </span>

            {result.page < result.totalPages ? (
              <Link
                href={buildQuestionExplorerHref({
                  ...query.filters,
                  page: result.page + 1,
                })}
                className={styles.pageLink}
              >
                Próxima
              </Link>
            ) : (
              <span
                className={styles.pageDisabled}
                aria-disabled="true"
              >
                Próxima
              </span>
            )}
          </nav>
        ) : null}
      </section>
    </div>
  );
}
