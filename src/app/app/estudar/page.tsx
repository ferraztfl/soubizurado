import Link from "next/link";
import { redirect } from "next/navigation";

import { createStudySessionAction } from "@/modules/study/presentation/actions/study-session-actions";
import { findStudentProfileId } from "@/modules/study/infrastructure/queries/answered-question-status";
import { todayInSaoPaulo } from "@/modules/study/infrastructure/queries/study-preferences";
import { countDueReviews, listStudySessions } from "@/modules/study/infrastructure/sessions/study-session-store";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";
import { PageHeader } from "@/shared/ui/page-header";

import styles from "./estudar.module.css";
import { StudySessionForm, type StudyDisciplineOption } from "./study-session-form";

export const dynamic = "force-dynamic";

type StudyPageProps = Readonly<{
  searchParams: Promise<Readonly<{ error?: string }>>;
}>;

const ERRORS: Readonly<Record<string, string>> = {
  invalido: "Escolha um modo e uma quantidade válidos.",
  "sem-revisoes": "Você não tem revisões vencidas com esse filtro. Que tal questões novas?",
  "sem-questoes": "Não encontramos questões novas com esse filtro. Tente outra matéria ou tópico.",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function StudyPage(props: StudyPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = await props.searchParams;
  const profileId = await findStudentProfileId(user.id);
  const prisma = getPrismaClient();
  const published = { some: { status: "PUBLISHED" as const } };

  const [dueReviews, sessions, disciplines] = await Promise.all([
    profileId ? countDueReviews(profileId, todayInSaoPaulo()) : 0,
    profileId ? listStudySessions(profileId) : [],
    prisma.discipline.findMany({
      where: { isActive: true, knowledgeAreaId: { not: null }, questions: published },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        areas: { where: { isActive: true, questions: published }, orderBy: { name: "asc" }, select: { id: true, name: true } },
      },
    }),
  ]);

  const options: StudyDisciplineOption[] = disciplines;
  const inProgress = sessions.filter((session) => session.status === "IN_PROGRESS");
  const finished = sessions.filter((session) => session.status === "FINISHED");

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Estudos"
        title="Estudar"
        description="Sessões guiadas com correção na hora. As questões que você erra voltam para revisão em intervalos crescentes (1, 3, 7, 15, 30 e 60 dias) até você dominá-las."
      />

      {params.error && ERRORS[params.error] ? (
        <div className={styles.notice} role="alert">
          {ERRORS[params.error]}
        </div>
      ) : null}

      <section className={dueReviews > 0 ? styles.reviewCardDue : styles.reviewCard} aria-label="Revisões de hoje">
        <div>
          <span className={styles.eyebrow}>Revisão espaçada</span>
          <strong>
            {dueReviews === 0
              ? "Nenhuma revisão vencida hoje"
              : `${dueReviews} ${dueReviews === 1 ? "questão para revisar" : "questões para revisar"} hoje`}
          </strong>
          <p>
            {dueReviews === 0
              ? "Quando você errar uma questão, ela volta aqui no dia seguinte."
              : "Revisar no dia certo é o que fixa o conteúdo na memória."}
          </p>
        </div>
        <div className={styles.reviewActions}>
        {dueReviews > 0 ? (
          <form action={createStudySessionAction}>
            <input type="hidden" name="mode" value="REVIEW" />
            <input type="hidden" name="size" value={dueReviews >= 20 ? 20 : dueReviews >= 10 ? 10 : 5} />
            <button type="submit" className={styles.primary}>
              Revisar agora
            </button>
          </form>
        ) : null}
          {/* Every question ever missed (not only today's due reviews), in the explorer. */}
          <Link href="/app/questoes?situacao=erradas" className={styles.secondary}>
            Todas as questões que já errei
          </Link>
        </div>
      </section>

      {inProgress.length > 0 ? (
        <section className={styles.card}>
          <h2>Continuar de onde parou</h2>
          <ul className={styles.sessions}>
            {inProgress.map((session) => (
              <li key={session.id}>
                <div>
                  <strong>{session.title}</strong>
                  <span>
                    {session.questionCount} questões · começou em {dateFormatter.format(session.startedAt)}
                  </span>
                </div>
                <Link href={`/app/estudar/${session.id}`} className={styles.secondary}>
                  Continuar
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={styles.card}>
        <h2>Nova sessão</h2>
        <StudySessionForm disciplines={options} />
      </section>

      {finished.length > 0 ? (
        <section className={styles.card}>
          <h2>Sessões recentes</h2>
          <ul className={styles.sessions}>
            {finished.map((session) => (
              <li key={session.id}>
                <div>
                  <strong>{session.title}</strong>
                  <span>
                    {session.correctCount ?? 0}/{session.questionCount} acertos · {dateFormatter.format(session.startedAt)}
                  </span>
                </div>
                <Link href={`/app/estudar/${session.id}/resultado`} className={styles.secondary}>
                  Ver resultado
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
