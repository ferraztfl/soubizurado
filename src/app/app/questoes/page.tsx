import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  createListPublishedQuestionsUseCase,
  createListQuestionExplorerFacetsUseCase,
} from "@/modules/question-bank/infrastructure/composition/question-bank-application";
import {
  buildQuestionExplorerHref,
  parseQuestionExplorerSearchParams,
  QUESTION_EXPLORER_PAGE_SIZE_COOKIE,
  QUESTION_EXPLORER_SITUATIONS,
  QUESTION_EXPLORER_SORT_COOKIE,
  QUESTION_EXPLORER_SORTS,
  type QuestionExplorerRawSearchParams,
} from "@/modules/question-bank/presentation/question-explorer-search-params";
import {
  findStudentProfileId,
  loadAnsweredQuestionStatus,
} from "@/modules/study/infrastructure/queries/answered-question-status";
import {
  EMPTY_QUESTION_STUDY_TOOLS,
  loadQuestionStudyTools,
} from "@/modules/study/infrastructure/queries/question-study-tools";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";
import { EmptyState } from "@/shared/ui/empty-state";
import { PageHeader } from "@/shared/ui/page-header";

import { QuestionExplorerFilters } from "./_components/question-explorer-filters";
import { QuestionListItem } from "./_components/question-list-item";
import { QuestionResultsToolbar } from "./_components/question-results-toolbar";

import styles from "./question-explorer.module.css";

const NO_PROFILE_ID = "00000000-0000-0000-0000-000000000000";

export const metadata: Metadata = {
  title: "Questões de concursos públicos grátis",
  description:
    "Resolva questões de concursos públicos e do ENEM com gabarito comentado por matéria, banca, órgão e ano. Crie sua conta grátis e acompanhe seu desempenho.",
  alternates: { canonical: "/questoes" },
};

type QuestionExplorerPageProps = Readonly<{
  searchParams: Promise<QuestionExplorerRawSearchParams>;
}>;

export default async function QuestionExplorerPage({ searchParams }: QuestionExplorerPageProps) {
  const cookieStore = await cookies();
  const query = parseQuestionExplorerSearchParams(await searchParams, {
    pageSize: cookieStore.get(QUESTION_EXPLORER_PAGE_SIZE_COOKIE)?.value,
    sort: cookieStore.get(QUESTION_EXPLORER_SORT_COOKIE)?.value,
  });

  // The signed-in student's profile: "Minhas questões" filter and the
  // "Resolvida / acertou / errou" marks.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profileId = user ? await findStudentProfileId(user.id) : null;

  const { situation, ...filters } = query.filters;
  const mySituation = situation ? QUESTION_EXPLORER_SITUATIONS[situation] : undefined;
  // Without a profile nothing was answered or starred yet: "não resolvidas" is
  // everything, the others are nothing (a profile id that matches no row).
  const myProfileId = profileId ?? NO_PROFILE_ID;
  const myFilters =
    mySituation === undefined || (mySituation === "unanswered" && !profileId)
      ? {}
      : mySituation === "favorite"
        ? { favoriteOfProfileId: myProfileId }
        : { answered: { profileId: myProfileId, status: mySituation } };

  const [result, facets] = await Promise.all([
    createListPublishedQuestionsUseCase().execute({
      page: query.page,
      pageSize: query.pageSize,
      sort: QUESTION_EXPLORER_SORTS[query.sort],
      filters: { ...filters, ...myFilters },
    }),
    createListQuestionExplorerFacetsUseCase().execute(),
  ]);

  const hrefBase = { ...query.filters, pageSize: query.pageSize, sort: query.sort };

  if (result.totalPages > 0 && result.page > result.totalPages) {
    redirect(buildQuestionExplorerHref({ ...hrefBase, page: result.totalPages }));
  }

  const pageQuestionIds = result.items.map((question) => question.id);
  const [answered, studyTools] = profileId
    ? await Promise.all([
        loadAnsweredQuestionStatus(profileId, pageQuestionIds),
        loadQuestionStudyTools(profileId, pageQuestionIds),
      ])
    : [new Map(), new Map()];

  const firstItem = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const lastItem = Math.min(result.page * result.pageSize, result.total);

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Banco de questões"
        title="Explorar questões"
        description="Filtre por matéria, banca, ano e tipo, e resolva as questões aqui mesmo. O gabarito só aparece depois da sua resposta."
      />

      <QuestionExplorerFilters key={JSON.stringify(query.filters)} facets={facets} query={query} />

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
                  tools={studyTools.get(question.id) ?? EMPTY_QUESTION_STUDY_TOOLS}
                  signedIn={Boolean(user)}
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
