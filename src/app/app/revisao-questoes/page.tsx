import Link from "next/link";

import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import styles from "./page.module.css";

export const dynamic =
  "force-dynamic";

export default async function ReviewQuestionsPage() {
  const prisma =
    getPrismaClient();

  const questions =
    await prisma.question.findMany({
      where: {
        status: "IN_REVIEW",
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
      },

      select: {
        id: true,
        statement: true,
        answerKeyStatus: true,

        discipline: {
          select: {
            name: true,
          },
        },

        topic: {
          select: {
            name: true,
          },
        },

        mediaLinks: {
          select: {
            id: true,
          },
        },

        alternatives: {
          select: {
            content: true,

            mediaLinks: {
              select: {
                id: true,
              },
            },
          },
        },
      },

      orderBy: [
        {
          updatedAt: "desc",
        },
        {
          id: "asc",
        },
      ],

      take: 100,
    });

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            Banco de Questões
          </p>

          <h1>
            Revisão de questões
          </h1>

          <p className={styles.description}>
            Questões importadas com mídia que ainda
            não foram publicadas.
          </p>
        </div>

        <div className={styles.count}>
          {questions.length} em revisão
        </div>
      </header>

      <div className={styles.list}>
        {questions.map(
          (question) => {
            const mediaCount =
              question.mediaLinks.length +
              question.alternatives.reduce(
                (total, alternative) =>
                  total +
                  alternative.mediaLinks.length,
                0,
              );

            const emptyAlternatives =
              question.alternatives.filter(
                (alternative) =>
                  !alternative.content.trim(),
              ).length;

            return (
              <Link
                key={question.id}
                href={`/app/revisao-questoes/${question.id}`}
                className={styles.card}
              >
                <div className={styles.cardTop}>
                  <span className={styles.status}>
                    IN_REVIEW
                  </span>

                  <span>
                    {mediaCount} mídia
                    {mediaCount === 1
                      ? ""
                      : "s"}
                  </span>
                </div>

                <h2>
                  {question.statement}
                </h2>

                <div className={styles.meta}>
                  <span>
                    Disciplina:{" "}
                    {question.discipline?.name ??
                      "Não definida"}
                  </span>

                  <span>
                    Tópico:{" "}
                    {question.topic?.name ??
                      "PENDENTE"}
                  </span>

                  <span>
                    Gabarito:{" "}
                    {question.answerKeyStatus}
                  </span>
                </div>

                {emptyAlternatives > 0 ? (
                  <p className={styles.warning}>
                    {emptyAlternatives} alternativa
                    {emptyAlternatives === 1
                      ? ""
                      : "s"}{" "}
                    sem conteúdo textual.
                  </p>
                ) : null}
              </Link>
            );
          },
        )}
      </div>
    </main>
  );
}