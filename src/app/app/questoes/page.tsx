import Link from "next/link";
import { redirect } from "next/navigation";

import {
  createListPublishedQuestionsUseCase,
  createListQuestionExplorerFacetsUseCase,
} from "@/modules/question-bank/infrastructure/composition/question-bank-application";
import {
  buildQuestionExplorerHref,
  parseQuestionExplorerSearchParams,
  QUESTION_EXPLORER_SORTS,
  type QuestionExplorerRawSearchParams,
} from "@/modules/question-bank/presentation/question-explorer-search-params";
import { loadAnsweredQuestionStatus } from "@/modules/study/infrastructure/queries/answered-question-status";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";
import { EmptyState } from "@/shared/ui/empty-state";
import { PageHeader } from "@/shared/ui/page-header";

import { QuestionExplorerFilters } from "./_components/question-explorer-filters";
import { QuestionListItem } from "./_components/question-list-item";
import { QuestionResultsToolbar } from "./_components/question-results-toolbar";

import styles from "./question-explorer.module.css";

type QuestionExplorerPageProps = Readonly<{
  searchParams: Promise<QuestionExplorerRawSearchParams>;
}>;

export default async function QuestionExplorerPage({ searchParams }: QuestionExplorerPageProps) {
  const query = parseQuestionExplorerSearchParams(await searchParams);

  const [result, facets] = await Promise.all([
    createListPublishedQuestionsUseCase().execute({
      page: query.page,
      pageSize: query.pageSize,
      sort: QUESTION_EXPLORER_SORTS[query.sort],
      filters: query.filters,
    }),
    createListQuestionExplorerFacetsUseCase().execute(),
  ]);

  const hrefBase = { ...query.filters, pageSize: query.pageSize, sort: query.sort };

  if (result.totalPages > 0 && result.page > result.totalPages) {
    redirect(buildQuestionExplorerHref({ ...hrefBase, page: result.totalPages }));
  }

  // "Resolvida / acertou / errou" marks for the signed-in student.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const answered = user
    ? await loadAnsweredQuestionStatus(user.id, result.items.map((question) => question.id))
    : new Map();

  const firstItem = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const lastItem = Math.min(result.page * result.pageSize, result.total);

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Banco de questões"
        title="Explorar questões"
        description="Filtre por matéria, banca, ano e tipo, e resolva as questões aqui mesmo. O gabarito só aparece depois da sua resposta."
      />

      <QuestionExplorerFilters facets={facets} query={query} />

      <section className={styles.results} aria-label="Questões encontradas">
        <QuestionResultsToolbar
          total={result.total}
          firstItem={firstItem}
          lastItem={lastItem}
          pageSize={query.pageSize}
          sort={query.sort}
        />

        {result.items.length === 0 ? (
          <div className={styles.emptyCard}>
            <EmptyState
              icon="?"
              title="Nenhuma questão encontrada"
              description="Ajuste os filtros ou limpe a busca para consultar outras questões publicadas."
            />
          </div>
        ) : (
          <ol className={styles.list}>
            {result.items.map((question, index) => (
              <li key={question.id}>
                <QuestionListItem
                  question={question}
                  position={firstItem + index}
                  status={answered.get(question.id) ?? null}
                />
              </li>
            ))}
          </ol>
        )}

        {result.totalPages > 1 ? (
          <nav className={styles.pagination} aria-label="Paginação das questões">
            {result.page > 1 ? (
              <Link href={buildQuestionExplorerHref({ ...hrefBase, page: result.page - 1 })} className={styles.pageLink}>
                Anterior
              </Link>
            ) : (
              <span className={styles.pageDisabled} aria-disabled="true">
                Anterior
              </span>
            )}

            <span className={styles.pageStatus}>
              Página {result.page} de {result.totalPages}
            </span>

            {result.page < result.totalPages ? (
              <Link href={buildQuestionExplorerHref({ ...hrefBase, page: result.page + 1 })} className={styles.pageLink}>
                Próxima
              </Link>
            ) : (
              <span className={styles.pageDisabled} aria-disabled="true">
                Próxima
              </span>
            )}
          </nav>
        ) : null}
      </section>
    </div>
  );
}
