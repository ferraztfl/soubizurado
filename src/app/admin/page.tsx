import Link from "next/link";

import {
  getPrismaClient,
} from "@/shared/infrastructure/database/prisma";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

function formatCount(value: number): string {
  return value.toLocaleString("pt-BR");
}

export default async function AdminHomePage() {
  const prisma = getPrismaClient();

  const [
    total,
    draft,
    inReview,
    published,
    archived,
    missingTopic,
  ] = await Promise.all([
    prisma.question.count(),

    prisma.question.count({
      where: {
        status: "DRAFT",
      },
    }),

    prisma.question.count({
      where: {
        status: "IN_REVIEW",
      },
    }),

    prisma.question.count({
      where: {
        status: "PUBLISHED",
      },
    }),

    prisma.question.count({
      where: {
        status: "ARCHIVED",
      },
    }),

    prisma.question.count({
      where: {
        topicId: null,
        status: {
          in: [
            "DRAFT",
            "IN_REVIEW",
          ],
        },
      },
    }),
  ]);

  const metrics = [
    {
      label: "Total de questões",
      value: total,
      detail: "Base cadastrada",
      tone: "neutral",
    },
    {
      label: "Em revisão",
      value: inReview,
      detail: "Aguardando validação",
      tone: "attention",
    },
    {
      label: "Sem tópico",
      value: missingTopic,
      detail: "Classificação pendente",
      tone: "critical",
    },
    {
      label: "Publicadas",
      value: published,
      detail: "Disponíveis aos alunos",
      tone: "success",
    },
  ] as const;

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
            Acompanhe a saúde editorial da base,
            priorize pendências e acesse as
            principais operações do backoffice.
          </p>
        </div>

        <Link
          href="/app/revisao-questoes"
          className={styles.primaryAction}
        >
          <span>
            Revisar questões
          </span>

          <span
            className={styles.actionArrow}
            aria-hidden="true"
          >
            →
          </span>
        </Link>
      </header>

      <section
        className={styles.metrics}
        aria-label="Resumo do banco de questões"
      >
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className={`${styles.metricCard} ${
              styles[metric.tone]
            }`}
          >
            <div className={styles.metricHeading}>
              <span className={styles.metricLabel}>
                {metric.label}
              </span>

              <span
                className={styles.metricIndicator}
                aria-hidden="true"
              />
            </div>

            <strong className={styles.metricValue}>
              {formatCount(metric.value)}
            </strong>

            <span className={styles.metricDetail}>
              {metric.detail}
            </span>
          </article>
        ))}
      </section>

      <section className={styles.workspaceGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.sectionEyebrow}>
                Fluxo editorial
              </p>

              <h2>
                Prioridades
              </h2>
            </div>

            <span className={styles.panelMeta}>
              Atualizado em tempo real
            </span>
          </div>

          <div className={styles.priorityList}>
            <div className={styles.priorityItem}>
              <div
                className={`${styles.priorityIcon} ${styles.priorityIconCritical}`}
                aria-hidden="true"
              >
                1
              </div>

              <div className={styles.priorityContent}>
                <div className={styles.priorityTitleRow}>
                  <strong>
                    Classificação taxonômica
                  </strong>

                  <span className={styles.priorityBadge}>
                    Prioridade alta
                  </span>
                </div>

                <p>
                  Questões ativas ainda sem tópico
                  canônico definido.
                </p>
              </div>

              <strong className={styles.priorityCount}>
                {formatCount(missingTopic)}
              </strong>
            </div>

            <div className={styles.priorityItem}>
              <div
                className={`${styles.priorityIcon} ${styles.priorityIconAttention}`}
                aria-hidden="true"
              >
                2
              </div>

              <div className={styles.priorityContent}>
                <div className={styles.priorityTitleRow}>
                  <strong>
                    Revisão editorial
                  </strong>
                </div>

                <p>
                  Questões aguardando validação antes
                  da publicação.
                </p>
              </div>

              <strong className={styles.priorityCount}>
                {formatCount(inReview)}
              </strong>
            </div>

            <div className={styles.priorityItem}>
              <div
                className={styles.priorityIcon}
                aria-hidden="true"
              >
                3
              </div>

              <div className={styles.priorityContent}>
                <div className={styles.priorityTitleRow}>
                  <strong>
                    Rascunhos
                  </strong>
                </div>

                <p>
                  Registros que ainda não entraram
                  na fila editorial.
                </p>
              </div>

              <strong className={styles.priorityCount}>
                {formatCount(draft)}
              </strong>
            </div>
          </div>

          <div className={styles.panelFooter}>
            <Link
              href="/app/revisao-questoes"
              className={styles.secondaryAction}
            >
              Abrir fila de revisão
              <span aria-hidden="true">
                →
              </span>
            </Link>
          </div>
        </article>

        <aside className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.sectionEyebrow}>
                Atalhos
              </p>

              <h2>
                Operações rápidas
              </h2>
            </div>
          </div>

          <div className={styles.quickActions}>
            <Link
              href="/app/revisao-questoes"
              className={styles.quickAction}
            >
              <div>
                <strong>
                  Revisar questões
                </strong>

                <span>
                  Classificar e publicar
                </span>
              </div>

              <span
                className={styles.quickActionArrow}
                aria-hidden="true"
              >
                →
              </span>
            </Link>

            <div className={styles.quickActionDisabled}>
              <div>
                <strong>
                  Nova questão
                </strong>

                <span>
                  Cadastro manual
                </span>
              </div>

              <span className={styles.comingSoon}>
                Em breve
              </span>
            </div>

            <div className={styles.quickActionDisabled}>
              <div>
                <strong>
                  Importações
                </strong>

                <span>
                  PDF, JSON, CSV e XLSX
                </span>
              </div>

              <span className={styles.comingSoon}>
                Em breve
              </span>
            </div>

            <div className={styles.quickActionDisabled}>
              <div>
                <strong>
                  Taxonomia
                </strong>

                <span>
                  Disciplinas, áreas e tópicos
                </span>
              </div>

              <span className={styles.comingSoon}>
                Em breve
              </span>
            </div>
          </div>
        </aside>
      </section>

      <section className={styles.baseStatus}>
        <div className={styles.baseStatusHeading}>
          <div>
            <p className={styles.sectionEyebrow}>
              Estado da base
            </p>

            <h2>
              Distribuição editorial
            </h2>
          </div>

          <span>
            {formatCount(total)} registros
          </span>
        </div>

        <div className={styles.baseStats}>
          <div>
            <span>
              Rascunhos
            </span>

            <strong>
              {formatCount(draft)}
            </strong>
          </div>

          <div>
            <span>
              Em revisão
            </span>

            <strong>
              {formatCount(inReview)}
            </strong>
          </div>

          <div>
            <span>
              Publicadas
            </span>

            <strong>
              {formatCount(published)}
            </strong>
          </div>

          <div>
            <span>
              Arquivadas
            </span>

            <strong>
              {formatCount(archived)}
            </strong>
          </div>
        </div>
      </section>
    </main>
  );
}
