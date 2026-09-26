import Link from "next/link";

import {
  labelFor,
  QUESTION_STATUS_LABELS,
} from "@/modules/question-bank/presentation/question-labels";
import { buildReviewQueueHref } from "@/modules/question-bank/presentation/review-queue-search-params";
import { LEGACY_ENEM_KNOWLEDGE_AREA_SLUGS } from "@/modules/taxonomy/application/legacy-enem-taxonomy-backfill";
import {
  getPrismaClient,
} from "@/shared/infrastructure/database/prisma";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const LEGACY_DISCIPLINE_SLUGS = new Set<string>(
  LEGACY_ENEM_KNOWLEDGE_AREA_SLUGS,
);

const STATUS_ORDER = [
  "DRAFT",
  "IN_REVIEW",
  "PUBLISHED",
  "ARCHIVED",
] as const;

const openSuggestion = {
  status: {
    in: [
      "COMPLETED" as const,
      "REVIEW_REQUIRED" as const,
    ],
  },
  appliedAt: null,
  suggestedTopicId: {
    not: null,
  },
};

function formatCount(value: number): string {
  return value.toLocaleString("pt-BR");
}

function percent(part: number, total: number): number {
  return total > 0
    ? Math.round((part / total) * 100)
    : 0;
}

export default async function AdminHomePage() {
  const prisma = getPrismaClient();

  const [
    statusGroups,
    inReviewWithTopic,
    awaitingDiscipline,
    withSuggestion,
    withHighConfidence,
    reviewByDiscipline,
    classifiedByDiscipline,
    lastRun,
  ] = await Promise.all([
    prisma.question.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),

    prisma.question.count({
      where: {
        status: "IN_REVIEW",
        topicId: { not: null },
      },
    }),

    // Legacy ENEM "disciplines" have no knowledge area link.
    prisma.question.count({
      where: {
        status: "IN_REVIEW",
        topicId: null,
        discipline: { knowledgeAreaId: null },
        knowledgeAreaId: { not: null },
      },
    }),

    prisma.question.count({
      where: {
        status: "IN_REVIEW",
        topicId: null,
        classificationTasks: { some: openSuggestion },
      },
    }),

    prisma.question.count({
      where: {
        status: "IN_REVIEW",
        topicId: null,
        classificationTasks: {
          some: {
            ...openSuggestion,
            status: "COMPLETED",
          },
        },
      },
    }),

    prisma.question.groupBy({
      by: ["disciplineId"],
      where: { status: "IN_REVIEW" },
      _count: { _all: true },
    }),

    prisma.question.groupBy({
      by: ["disciplineId"],
      where: {
        status: "IN_REVIEW",
        topicId: { not: null },
      },
      _count: { _all: true },
    }),

    prisma.questionClassificationTask.findFirst({
      where: { completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      select: {
        completedAt: true,
        provider: true,
        model: true,
      },
    }),
  ]);

  const countByStatus = new Map(
    statusGroups.map((group) => [group.status, group._count._all]),
  );

  const total = statusGroups.reduce(
    (sum, group) => sum + group._count._all,
    0,
  );
  const inReview = countByStatus.get("IN_REVIEW") ?? 0;
  const published = countByStatus.get("PUBLISHED") ?? 0;
  const classifiedPercent = percent(inReviewWithTopic, inReview);

  const disciplines = await prisma.discipline.findMany({
    where: {
      id: {
        in: reviewByDiscipline
          .map((row) => row.disciplineId)
          .filter((id): id is string => id !== null),
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  const classifiedCount = new Map(
    classifiedByDiscipline.map((row) => [row.disciplineId, row._count._all]),
  );

  const disciplineRows = disciplines
    .map((discipline) => {
      const count =
        reviewByDiscipline.find((row) => row.disciplineId === discipline.id)
          ?._count._all ?? 0;

      return {
        id: discipline.id,
        name: discipline.name,
        legacy: LEGACY_DISCIPLINE_SLUGS.has(discipline.slug),
        count,
        classified: classifiedCount.get(discipline.id) ?? 0,
      };
    })
    .sort((left, right) => right.count - left.count);

  const maxDisciplineCount = Math.max(
    1,
    ...disciplineRows.map((row) => row.count),
  );

  const metrics = [
    {
      label: "Em revisão",
      value: formatCount(inReview),
      detail: `${formatCount(total)} questões na base`,
      tone: "attention",
    },
    {
      label: "Classificadas",
      value: formatCount(inReviewWithTopic),
      detail: `${classifiedPercent}% das questões em revisão`,
      tone: inReviewWithTopic > 0 ? "success" : "neutral",
    },
    {
      label: "Com sugestão automática",
      value: formatCount(withSuggestion),
      detail: `${formatCount(withHighConfidence)} com alta confiança`,
      tone: "info",
    },
    {
      label: "Publicadas",
      value: formatCount(published),
      detail: "Disponíveis para os alunos",
      tone: published > 0 ? "success" : "neutral",
    },
  ] as const;

  const nextActions = [
    {
      title: "Aplicar sugestões automáticas",
      description:
        "Questões sem tópico que já têm uma sugestão do classificador.",
      count: withSuggestion,
      href: buildReviewQueueHref({ suggestion: "with" }),
    },
    {
      title: "Definir disciplina",
      description:
        "Questões ainda nas áreas antigas do ENEM, sem disciplina específica.",
      count: awaitingDiscipline,
      href: buildReviewQueueHref({}),
    },
    {
      title: "Publicar classificadas",
      description:
        "Questões com tópico que podem seguir para a publicação.",
      count: inReviewWithTopic,
      href: buildReviewQueueHref({ topic: "assigned" }),
    },
  ];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <p className={styles.eyebrow}>
            Banco de questões
          </p>

          <h1>
            Visão geral
          </h1>

          <p className={styles.description}>
            Acompanhe a classificação e a publicação do
            banco de questões e siga para as próximas ações.
          </p>
        </div>

        <Link
          href="/admin/questoes/revisao"
          className={styles.primaryAction}
        >
          Abrir revisão editorial
          <span aria-hidden="true">
            →
          </span>
        </Link>
      </header>

      <section
        className={styles.metrics}
        aria-label="Indicadores do banco de questões"
      >
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className={`${styles.metricCard} ${styles[`metric_${metric.tone}`]}`}
          >
            <span className={styles.metricLabel}>
              <span
                className={styles.metricDot}
                aria-hidden="true"
              />
              {metric.label}
            </span>

            <strong className={styles.metricValue}>
              {metric.value}
            </strong>

            <span className={styles.metricDetail}>
              {metric.detail}
            </span>
          </article>
        ))}
      </section>

      <section className={styles.progressCard}>
        <div className={styles.progressHeader}>
          <div>
            <p className={styles.sectionEyebrow}>
              Classificação taxonômica
            </p>

            <h2>
              {classifiedPercent}% das questões em revisão já têm tópico
            </h2>
          </div>

          {lastRun?.completedAt ? (
            <span className={styles.progressMeta}>
              Última classificação automática em{" "}
              {lastRun.completedAt.toLocaleDateString("pt-BR")}
            </span>
          ) : null}
        </div>

        <div
          className={styles.progressBar}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={classifiedPercent}
          aria-label="Questões em revisão com tópico"
        >
          <span style={{ width: `${classifiedPercent}%` }} />
        </div>

        <dl className={styles.statusRow}>
          {STATUS_ORDER.map((status) => (
            <div key={status}>
              <dt>
                {labelFor(QUESTION_STATUS_LABELS, status).label}
              </dt>
              <dd>
                {formatCount(countByStatus.get(status) ?? 0)}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.workspaceGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.sectionEyebrow}>
                Em revisão
              </p>

              <h2>
                Questões por disciplina
              </h2>
            </div>

            <span className={styles.panelMeta}>
              Barra verde: já classificadas
            </span>
          </div>

          <ul className={styles.disciplineList}>
            {disciplineRows.map((row) => (
              <li key={row.id}>
                <Link
                  href={buildReviewQueueHref({ disciplineId: row.id })}
                  className={styles.disciplineRow}
                >
                  <span className={styles.disciplineName}>
                    {row.name}
                    {row.legacy ? (
                      <span className={styles.legacyTag}>
                        Área antiga do ENEM
                      </span>
                    ) : null}
                  </span>

                  <span className={styles.disciplineCount}>
                    {formatCount(row.count)}
                  </span>

                  <span
                    className={styles.disciplineBar}
                    aria-hidden="true"
                  >
                    <span
                      className={styles.disciplineBarTotal}
                      style={{ width: `${(row.count / maxDisciplineCount) * 100}%` }}
                    >
                      <span
                        className={styles.disciplineBarDone}
                        style={{ width: `${percent(row.classified, row.count)}%` }}
                      />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </article>

        <aside className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.sectionEyebrow}>
                Fluxo editorial
              </p>

              <h2>
                Próximas ações
              </h2>
            </div>
          </div>

          <ol className={styles.actionList}>
            {nextActions.map((action, index) => (
              <li key={action.title}>
                <Link
                  href={action.href}
                  className={styles.actionItem}
                >
                  <span
                    className={styles.actionStep}
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>

                  <span className={styles.actionCopy}>
                    <strong>{action.title}</strong>
                    <span>{action.description}</span>
                  </span>

                  <span className={styles.actionCount}>
                    {formatCount(action.count)}
                  </span>
                </Link>
              </li>
            ))}
          </ol>

          <div className={styles.soonList}>
            <span className={styles.sectionEyebrow}>
              Em breve no backoffice
            </span>
            <p>
              Cadastro manual de questões, central de importações
              (PDF, JSON, CSV e XLSX) e gestão da taxonomia.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
