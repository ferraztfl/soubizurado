import Link from "next/link";

import {
  getPrismaClient,
} from "@/shared/infrastructure/database/prisma";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

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
    },
    {
      label: "Em revisão",
      value: inReview,
    },
    {
      label: "Publicadas",
      value: published,
    },
    {
      label: "Rascunhos",
      value: draft,
    },
    {
      label: "Arquivadas",
      value: archived,
    },
    {
      label: "Sem tópico",
      value: missingTopic,
    },
  ];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            Backoffice
          </p>

          <h1>
            Administração
          </h1>

          <p className={styles.description}>
            Gestão editorial do banco de questões,
            importações, taxonomia e publicação.
          </p>
        </div>

        <Link
          href="/app/revisao-questoes"
          className={styles.primaryAction}
        >
          Revisar questões
        </Link>
      </header>

      <section
        className={styles.metrics}
        aria-label="Resumo do banco de questões"
      >
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className={styles.metricCard}
          >
            <span>
              {metric.label}
            </span>

            <strong>
              {metric.value.toLocaleString("pt-BR")}
            </strong>
          </article>
        ))}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>
              Operação editorial
            </p>

            <h2>
              Banco de questões
            </h2>
          </div>
        </div>

        <div className={styles.actionsGrid}>
          <Link
            href="/app/revisao-questoes"
            className={styles.actionCard}
          >
            <strong>
              Revisão de questões
            </strong>

            <span>
              Classifique, valide e publique questões
              que aguardam revisão.
            </span>
          </Link>

          <div className={styles.actionCardMuted}>
            <strong>
              Cadastro manual
            </strong>

            <span>
              Próxima etapa do Backoffice.
            </span>
          </div>

          <div className={styles.actionCardMuted}>
            <strong>
              Central de importações
            </strong>

            <span>
              PDF, JSON, CSV e XLSX.
            </span>
          </div>

          <div className={styles.actionCardMuted}>
            <strong>
              Taxonomia
            </strong>

            <span>
              Disciplinas, áreas, tópicos e subtópicos.
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}

