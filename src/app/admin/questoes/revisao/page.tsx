import Link from "next/link";

import type { Prisma } from "@/generated/prisma/client";
import {
  buildReviewQueueHref,
  parseReviewQueueSearchParams,
  type ReviewQueueRawSearchParams,
} from "@/modules/question-bank/presentation/review-queue-search-params";
import { LEGACY_ENEM_KNOWLEDGE_AREA_SLUGS } from "@/modules/taxonomy/application/legacy-enem-taxonomy-backfill";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import styles from "./page.module.css";

export const dynamic =
  "force-dynamic";

type ReviewQuestionsPageProps =
  Readonly<{
    searchParams: Promise<ReviewQueueRawSearchParams>;
  }>;

const STATEMENT_PREVIEW_LENGTH = 320;

const LEGACY_DISCIPLINE_SLUGS =
  new Set<string>(
    LEGACY_ENEM_KNOWLEDGE_AREA_SLUGS,
  );

const hasOpenSuggestion: Prisma.QuestionWhereInput = {
  classificationTasks: {
    some: {
      status: { in: ["COMPLETED", "REVIEW_REQUIRED"] },
      appliedAt: null,
      suggestedTopicId: { not: null },
    },
  },
};

const hasMedia: Prisma.QuestionWhereInput = {
  OR: [
    {
      mediaLinks: {
        some: {},
      },
    },
    {
      alternatives: {
        some: {
          mediaLinks: {
            some: {},
          },
        },
      },
    },
  ],
};

function formatCount(value: number): string {
  return value.toLocaleString("pt-BR");
}

function previewStatement(statement: string): string {
  const compact = statement.replace(/\s+/g, " ").trim();

  return compact.length > STATEMENT_PREVIEW_LENGTH
    ? `${compact.slice(0, STATEMENT_PREVIEW_LENGTH).trimEnd()}…`
    : compact;
}

export default async function ReviewQuestionsPage({
  searchParams,
}: ReviewQuestionsPageProps) {
  const query =
    parseReviewQueueSearchParams(
      await searchParams,
    );

  const prisma =
    getPrismaClient();

  const where: Prisma.QuestionWhereInput = {
    status: "IN_REVIEW",
    ...(query.disciplineId
      ? { disciplineId: query.disciplineId }
      : {}),
    ...(query.topic === "missing"
      ? { topicId: null }
      : query.topic === "assigned"
        ? { topicId: { not: null } }
        : {}),
    ...(query.search
      ? {
          statement: {
            contains: query.search,
            mode: "insensitive",
          },
        }
      : {}),
    AND: [
      query.media === "with"
        ? hasMedia
        : query.media === "without"
          ? { NOT: hasMedia }
          : {},
      query.suggestion === "with" ? hasOpenSuggestion : {},
    ],
  };

  const [
    total,
    reviewCount,
    missingTopicCount,
    disciplineCounts,
  ] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.count({
      where: { status: "IN_REVIEW" },
    }),
    prisma.question.count({
      where: {
        status: "IN_REVIEW",
        topicId: null,
      },
    }),
    prisma.question.groupBy({
      by: ["disciplineId"],
      where: { status: "IN_REVIEW" },
      _count: { _all: true },
    }),
  ]);

  const totalPages =
    Math.max(1, Math.ceil(total / query.pageSize));
  const page =
    Math.min(query.page, totalPages);

  const [questions, disciplines] = await Promise.all([
    prisma.question.findMany({
      where,
      orderBy: [
        { updatedAt: "desc" },
        { id: "asc" },
      ],
      skip: (page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        statement: true,
        answerKeyStatus: true,

        knowledgeArea: {
          select: { name: true },
        },

        discipline: {
          select: { name: true },
        },

        topic: {
          select: { name: true },
        },

        subtopic: {
          select: { name: true },
        },

        examination: {
          select: { title: true },
        },

        _count: {
          select: { mediaLinks: true },
        },

        classificationTasks: {
          where: {
            status: { in: ["COMPLETED", "REVIEW_REQUIRED"] },
            appliedAt: null,
            suggestedTopicId: { not: null },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            confidence: true,
            suggestedTopic: { select: { name: true } },
          },
        },

        alternatives: {
          select: {
            content: true,
            _count: {
              select: { mediaLinks: true },
            },
          },
        },
      },
    }),
    prisma.discipline.findMany({
      where: {
        id: {
          in: disciplineCounts
            .map((row) => row.disciplineId)
            .filter((id): id is string => id !== null),
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    }),
  ]);

  const countByDiscipline = new Map(
    disciplineCounts.map((row) => [row.disciplineId, row._count._all]),
  );

  const disciplineOptions = disciplines
    .map((discipline) => ({
      id: discipline.id,
      label: LEGACY_DISCIPLINE_SLUGS.has(discipline.slug)
        ? `${discipline.name} (antiga ENEM)`
        : discipline.name,
      count: countByDiscipline.get(discipline.id) ?? 0,
    }))
    .sort(
      (left, right) =>
        right.count - left.count ||
        left.label.localeCompare(right.label, "pt-BR"),
    );

  const firstItem =
    total === 0 ? 0 : (page - 1) * query.pageSize + 1;
  const lastItem =
    Math.min(page * query.pageSize, total);

  const hrefFor = (targetPage: number) =>
    buildReviewQueueHref({
      search: query.search,
      disciplineId: query.disciplineId,
      topic: query.topic,
      media: query.media,
      suggestion: query.suggestion,
      page: targetPage,
    });

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            Banco de questões
          </p>

          <h1>
            Revisão editorial
          </h1>

          <p className={styles.description}>
            Classifique e publique questões
            importadas. A publicação sempre passa
            pela política do banco de questões.
          </p>
        </div>

        <dl className={styles.summary}>
          <div>
            <dt>Em revisão</dt>
            <dd>{formatCount(reviewCount)}</dd>
          </div>

          <div>
            <dt>Sem tópico</dt>
            <dd>{formatCount(missingTopicCount)}</dd>
          </div>

          <div>
            <dt>Com tópico</dt>
            <dd>{formatCount(reviewCount - missingTopicCount)}</dd>
          </div>
        </dl>
      </header>

      <form
        className={styles.filters}
        action="/admin/questoes/revisao"
        method="get"
      >
        <label className={styles.searchField}>
          <span>Buscar no enunciado</span>
          <input
            type="search"
            name="q"
            defaultValue={query.search ?? ""}
            placeholder="Ex.: reta de tendência"
            maxLength={200}
          />
        </label>

        <label>
          <span>Disciplina</span>
          <select
            name="discipline"
            defaultValue={query.disciplineId ?? ""}
          >
            <option value="">
              Todas as disciplinas
            </option>

            {disciplineOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {`${option.label} (${formatCount(option.count)})`}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Classificação</span>
          <select name="topic" defaultValue={query.topic}>
            <option value="missing">Sem tópico</option>
            <option value="assigned">Com tópico</option>
            <option value="all">Todas</option>
          </select>
        </label>

        <label>
          <span>Mídia</span>
          <select name="media" defaultValue={query.media}>
            <option value="all">Todas</option>
            <option value="with">Com mídia</option>
            <option value="without">Sem mídia</option>
          </select>
        </label>

        <label>
          <span>Sugestão</span>
          <select name="suggestion" defaultValue={query.suggestion}>
            <option value="all">Todas</option>
            <option value="with">Com sugestão</option>
          </select>
        </label>

        <div className={styles.filterActions}>
          <button type="submit">Filtrar</button>
          <Link href="/admin/questoes/revisao">Limpar</Link>
        </div>
      </form>

      <div className={styles.resultsBar}>
        <span>
          {total === 0
            ? "Nenhuma questão encontrada"
            : `Mostrando ${formatCount(firstItem)}–${formatCount(lastItem)} de ${formatCount(total)}`}
        </span>

        {totalPages > 1 ? (
          <span>
            Página {formatCount(page)} de {formatCount(totalPages)}
          </span>
        ) : null}
      </div>

      {questions.length === 0 ? (
        <div className={styles.empty}>
          <strong>Nada por aqui</strong>
          <p>
            Ajuste os filtros para ver outras
            questões em revisão.
          </p>
        </div>
      ) : (
        <ol className={styles.list}>
          {questions.map((question) => {
            const mediaCount =
              question._count.mediaLinks +
              question.alternatives.reduce(
                (sum, alternative) =>
                  sum + alternative._count.mediaLinks,
                0,
              );

            const emptyAlternatives =
              question.alternatives.filter(
                (alternative) => !alternative.content.trim(),
              ).length;

            const classification = [
              question.topic?.name,
              question.subtopic?.name,
            ]
              .filter(Boolean)
              .join(" › ");

            return (
              <li key={question.id}>
                <Link
                  href={`/admin/questoes/revisao/${question.id}`}
                  className={styles.card}
                >
                  <div className={styles.cardTop}>
                    <span className={styles.discipline}>
                      {question.discipline?.name ?? "Sem disciplina"}
                    </span>

                    {question.examination ? (
                      <span>{question.examination.title}</span>
                    ) : null}

                    {mediaCount > 0 ? (
                      <span>
                        {mediaCount} mídia{mediaCount === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </div>

                  <p className={styles.statement}>
                    {previewStatement(question.statement)}
                  </p>

                  <div className={styles.cardBottom}>
                    {classification ? (
                      <span className={styles.badgeOk}>
                        {classification}
                      </span>
                    ) : (
                      <span className={styles.badgePending}>
                        Sem tópico
                      </span>
                    )}

                    {question.classificationTasks[0]?.suggestedTopic ? (
                      <span className={styles.badgeSuggestion}>
                        Sugestão: {question.classificationTasks[0].suggestedTopic.name}
                        {question.classificationTasks[0].confidence !== null
                          ? ` (${Math.round(Number(question.classificationTasks[0].confidence) * 100)}%)`
                          : ""}
                      </span>
                    ) : null}

                    {question.answerKeyStatus === "MISSING" ? (
                      <span className={styles.badgeWarning}>
                        Sem gabarito
                      </span>
                    ) : null}

                    {emptyAlternatives > 0 ? (
                      <span className={styles.badgeWarning}>
                        {emptyAlternatives} alternativa
                        {emptyAlternatives === 1 ? "" : "s"} sem texto
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      {totalPages > 1 ? (
        <nav
          className={styles.pagination}
          aria-label="Paginação da revisão"
        >
          {page > 1 ? (
            <Link href={hrefFor(page - 1)}>← Anterior</Link>
          ) : (
            <span aria-disabled="true">← Anterior</span>
          )}

          {page < totalPages ? (
            <Link href={hrefFor(page + 1)}>Próxima →</Link>
          ) : (
            <span aria-disabled="true">Próxima →</span>
          )}
        </nav>
      ) : null}
    </main>
  );
}
