import Link from "next/link";
import { notFound } from "next/navigation";

import { QuestionMedia } from "../../questoes/_components/question-media";

import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import styles from "./page.module.css";

export const dynamic =
  "force-dynamic";

type PageProps =
  Readonly<{
    params:
      | Readonly<{
          questionId: string;
        }>
      | Promise<
          Readonly<{
            questionId: string;
          }>
        >;
  }>;

export default async function ReviewQuestionPage(
  props: PageProps,
) {
  const {
    questionId,
  } = await props.params;

  const prisma =
    getPrismaClient();

  const question =
    await prisma.question.findFirst({
      where: {
        id: questionId,
        status: "IN_REVIEW",
      },

      select: {
        id: true,
        statement: true,
        type: true,
        answerKeyStatus: true,
        sourceId: true,
        disciplineId: true,
        topicId: true,

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

        examination: {
          select: {
            title: true,
            year: true,

            board: {
              select: {
                acronym: true,
                name: true,
              },
            },
          },
        },

        supportLinks: {
          orderBy: {
            position: "asc",
          },

          select: {
            position: true,

            supportContent: {
              select: {
                id: true,
                content: true,
              },
            },
          },
        },

        mediaLinks: {
          orderBy: {
            position: "asc",
          },

          select: {
            position: true,

            mediaAsset: {
              select: {
                id: true,
                mimeType: true,
                width: true,
                height: true,
                altText: true,
              },
            },
          },
        },

        alternatives: {
          orderBy: {
            position: "asc",
          },

          select: {
            id: true,
            label: true,
            content: true,
            position: true,
            isCorrect: true,

            mediaLinks: {
              orderBy: {
                position: "asc",
              },

              select: {
                position: true,

                mediaAsset: {
                  select: {
                    id: true,
                    mimeType: true,
                    width: true,
                    height: true,
                    altText: true,
                  },
                },
              },
            },
          },
        },
      },
    });

  if (!question) {
    notFound();
  }

  const questionMedia =
    question.mediaLinks.map(
      (link) => ({
        id:
          link.mediaAsset.id,

        url:
          `/api/media/${link.mediaAsset.id}`,

        mimeType:
          link.mediaAsset.mimeType,

        width:
          link.mediaAsset.width,

        height:
          link.mediaAsset.height,

        altText:
          link.mediaAsset.altText,

        position:
          link.position,
      }),
    );

  const publicationIssues: string[] =
    [];

  if (!question.sourceId) {
    publicationIssues.push(
      "Origem não definida",
    );
  }

  if (!question.disciplineId) {
    publicationIssues.push(
      "Disciplina não definida",
    );
  }

  if (!question.topicId) {
    publicationIssues.push(
      "Tópico obrigatório",
    );
  }

  if (
    question.alternatives.some(
      (alternative) =>
        !alternative.content.trim(),
    )
  ) {
    publicationIssues.push(
      "Existe alternativa sem conteúdo textual",
    );
  }

  return (
    <main className={styles.page}>
      <Link
        href="/app/revisao-questoes"
        className={styles.back}
      >
        ← Voltar para revisão
      </Link>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            Preview interno
          </p>

          <h1>
            Questão em revisão
          </h1>
        </div>

        <span className={styles.status}>
          IN_REVIEW
        </span>
      </header>

      <section className={styles.reviewBox}>
        <strong>
          Pendências para publicação
        </strong>

        <ul>
          {publicationIssues.map(
            (issue) => (
              <li key={issue}>
                {issue}
              </li>
            ),
          )}
        </ul>
      </section>

      <section className={styles.meta}>
        <span>
          Disciplina:{" "}
          {question.discipline?.name ??
            "Não definida"}
        </span>

        <span>
          Tópico:{" "}
          {question.topic?.name ??
            "Não definido"}
        </span>

        <span>
          Gabarito:{" "}
          {question.answerKeyStatus}
        </span>

        {question.examination ? (
          <span>
            Prova:{" "}
            {question.examination.title}
          </span>
        ) : null}
      </section>

      {question.supportLinks.length >
      0 ? (
        <section className={styles.support}>
          {question.supportLinks.map(
            (link) => (
              <p key={link.supportContent.id}>
                {link.supportContent.content}
              </p>
            ),
          )}
        </section>
      ) : null}

      <section className={styles.question}>
        <div className={styles.statement}>
          {question.statement}
        </div>

        <QuestionMedia
          media={questionMedia}
          fallbackAlt="Imagem da questão"
        />

        <div className={styles.alternatives}>
          {question.alternatives.map(
            (alternative) => {
              const media =
                alternative.mediaLinks.map(
                  (link) => ({
                    id:
                      link.mediaAsset.id,

                    url:
                      `/api/media/${link.mediaAsset.id}`,

                    mimeType:
                      link.mediaAsset.mimeType,

                    width:
                      link.mediaAsset.width,

                    height:
                      link.mediaAsset.height,

                    altText:
                      link.mediaAsset.altText,

                    position:
                      link.position,
                  }),
                );

              return (
                <div
                  key={alternative.id}
                  className={
                    styles.alternative
                  }
                >
                  <div
                    className={
                      styles.alternativeHeader
                    }
                  >
                    <strong>
                      {alternative.label}
                    </strong>

                    {alternative.isCorrect ? (
                      <span
                        className={
                          styles.correct
                        }
                      >
                        Gabarito
                      </span>
                    ) : null}
                  </div>

                  {alternative.content.trim() ? (
                    <p>
                      {alternative.content}
                    </p>
                  ) : (
                    <p
                      className={
                        styles.empty
                      }
                    >
                      Alternativa sem
                      conteúdo textual
                    </p>
                  )}

                  <QuestionMedia
                    media={media}
                    variant="alternative"
                    fallbackAlt={`Imagem da alternativa ${alternative.label}`}
                  />
                </div>
              );
            },
          )}
        </div>
      </section>
    </main>
  );
}