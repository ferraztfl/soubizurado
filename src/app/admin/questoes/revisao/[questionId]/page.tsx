import Link from "next/link";
import {
  notFound,
} from "next/navigation";

import {
  type QuestionPublicationIssue,
  validateQuestionForPublication,
} from "@/modules/question-bank/domain/question-publication-policy";
import {
  getPrismaClient,
} from "@/shared/infrastructure/database/prisma";

import {
  QuestionMedia,
} from "@/app/app/questoes/_components/question-media";

import {
  encodeSubtopicChoice,
  encodeTopicChoice,
} from "@/modules/question-bank/presentation/question-classification-choice";

import {
  publishQuestionAction,
  saveQuestionClassificationAction,
} from "./actions";

import styles from "./page.module.css";

export const dynamic =
  "force-dynamic";

// Indents subtopics under their topic inside a native <select>.
const SUBTOPIC_PREFIX =
  "\u00a0\u00a0\u21b3 ";

type PageProps =
  Readonly<{
    params:
      Promise<
        Readonly<{
          questionId: string;
        }>
      >;

    searchParams:
      Promise<
        Readonly<{
          error?: string;
          saved?: string;
        }>
      >;
  }>;

const issueLabels:
  Readonly<Record<QuestionPublicationIssue, string>> = {
    STATEMENT_REQUIRED:
      "Enunciado obrigatório.",

    SOURCE_REQUIRED:
      "Origem obrigatória.",

    DISCIPLINE_REQUIRED:
      "Disciplina obrigatória.",

    TOPIC_REQUIRED:
      "Tópico obrigatório.",

    ALTERNATIVE_CONTENT_REQUIRED:
      "Existe alternativa sem conteúdo textual.",

    MULTIPLE_CHOICE_ALTERNATIVES_REQUIRED:
      "Questões de múltipla escolha precisam de pelo menos duas alternativas.",

    MULTIPLE_CHOICE_SINGLE_CORRECT_REQUIRED:
      "A questão deve possuir exatamente uma alternativa correta.",

    MULTIPLE_CHOICE_BOOLEAN_ANSWER_NOT_ALLOWED:
      "Questões de múltipla escolha não podem possuir gabarito Certo/Errado.",

    TRUE_FALSE_ANSWER_REQUIRED:
      "O gabarito de Certo/Errado precisa estar definido.",

    TRUE_FALSE_ALTERNATIVES_NOT_ALLOWED:
      "Questões de Certo/Errado não podem possuir alternativas.",
  };

const errorMessages:
  Readonly<Record<string, string>> = {
    "topic-required":
      "Selecione um tópico antes de salvar.",

    "invalid-topic":
      "O tópico selecionado não pertence à disciplina da questão ou está inativo.",

    "answer-key":
      "O gabarito ainda não está pronto para publicação.",

    "publication-blocked":
      "A questão ainda possui pendências e não pode ser publicada.",

    "question-unavailable":
      "A questão não está mais disponível para revisão.",
  };

export default async function ReviewQuestionPage(
  props: PageProps,
) {
  const {
    questionId,
  } =
    await props.params;

  const searchParams =
    await props.searchParams;

  const prisma =
    getPrismaClient();

  const question =
    await prisma.question.findFirst({
      where: {
        id:
          questionId,

        status:
          "IN_REVIEW",
      },

      select: {
        id: true,
        statement: true,
        type: true,
        answerKeyStatus: true,
        correctTrueFalse: true,
        sourceId: true,
        disciplineId: true,
        topicId: true,
        subtopicId: true,

        knowledgeArea: {
          select: {
            name: true,
          },
        },

        discipline: {
          select: {
            name: true,
          },
        },

        area: {
          select: {
            name: true,
          },
        },

        subtopic: {
          select: {
            name: true,
          },
        },

        topic: {
          select: {
            id: true,
            name: true,
            disciplineId: true,
            isActive: true,
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
            position:
              "asc",
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
            position:
              "asc",
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
            position:
              "asc",
          },

          select: {
            id: true,
            label: true,
            content: true,
            position: true,
            isCorrect: true,

            mediaLinks: {
              orderBy: {
                position:
                  "asc",
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

  // Active taxonomy of the question discipline, grouped by assunto.
  const taxonomyTopics =
    question.disciplineId
      ? await prisma.topic.findMany({
          where: {
            disciplineId:
              question.disciplineId,

            isActive:
              true,

            OR: [
              {
                areaId:
                  null,
              },
              {
                area: {
                  isActive:
                    true,
                },
              },
            ],
          },

          orderBy: [
            {
              sortOrder:
                "asc",
            },
            {
              name:
                "asc",
            },
          ],

          select: {
            id: true,
            name: true,

            area: {
              select: {
                id: true,
                name: true,
                sortOrder: true,
              },
            },

            subtopics: {
              where: {
                isActive:
                  true,
              },

              orderBy: [
                {
                  sortOrder:
                    "asc",
                },
                {
                  name:
                    "asc",
                },
              ],

              select: {
                id: true,
                name: true,
              },
            },
          },
        })
      : [];

  type TopicGroup = {
    name: string;
    sortOrder: number;
    topics: typeof taxonomyTopics;
  };

  const topicGroupMap =
    new Map<string, TopicGroup>();

  for (const topic of taxonomyTopics) {
    const key =
      topic.area?.id ?? "";

    const group =
      topicGroupMap.get(key) ?? {
        name:
          topic.area?.name ??
          "Sem assunto",
        sortOrder:
          topic.area?.sortOrder ??
          Number.MAX_SAFE_INTEGER,
        topics: [],
      };

    group.topics.push(topic);
    topicGroupMap.set(key, group);
  }

  const topicGroups =
    [...topicGroupMap.values()].sort(
      (left, right) =>
        left.sortOrder -
          right.sortOrder ||
        left.name.localeCompare(
          right.name,
          "pt-BR",
        ),
    );

  const currentChoice =
    question.subtopicId
      ? encodeSubtopicChoice(
          question.subtopicId,
        )
      : question.topicId
        ? encodeTopicChoice(
            question.topicId,
          )
        : "";

  const classificationPath =
    [
      question.area?.name,
      question.topic?.name,
      question.subtopic?.name,
    ]
      .filter(Boolean)
      .join(" › ");

  const publicationIssues =
    validateQuestionForPublication({
      statement:
        question.statement,

      sourceId:
        question.sourceId,

      disciplineId:
        question.disciplineId,

      topicId:
        question.topicId,

      type:
        question.type,

      correctTrueFalse:
        question.correctTrueFalse,

      alternatives:
        question.alternatives.map(
          (alternative) => ({
            content:
              alternative.content,

            isCorrect:
              alternative.isCorrect,
          }),
        ),
    });

  const taxonomyIsValid =
    Boolean(
      question.topic &&
      question.topicId &&
      question.disciplineId &&
      question.topic.disciplineId ===
        question.disciplineId &&
      question.topic.isActive,
    );

  const answerKeyIsReady =
    question.answerKeyStatus ===
      "DEFINED" ||
    question.answerKeyStatus ===
      "VERIFIED";

  const canPublish =
    publicationIssues.length === 0 &&
    taxonomyIsValid &&
    answerKeyIsReady;

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

  const errorMessage =
    searchParams.error
      ? errorMessages[
          searchParams.error
        ] ??
        "Não foi possível concluir a operação."
      : null;

  return (
    <main className={styles.page}>
      <Link
        href="/admin/questoes/revisao"
        className={styles.back}
      >
        ← Voltar para revisão
      </Link>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            Revisão administrativa
          </p>

          <h1>
            Revisar questão
          </h1>
        </div>

        <span className={styles.status}>
          IN_REVIEW
        </span>
      </header>

      {searchParams.saved === "1" ? (
        <div className={styles.noticeSuccess}>
          Classificação salva com sucesso.
        </div>
      ) : null}

      {errorMessage ? (
        <div className={styles.noticeError}>
          {errorMessage}
        </div>
      ) : null}

      <section className={styles.editor}>
        <div>
          <h2 className={styles.editorTitle}>
            Classificação e publicação
          </h2>

          <p
            className={
              styles.editorDescription
            }
          >
            Escolha o tópico ou, quando possível,
            o subtópico da disciplina desta questão.
            A publicação só é liberada quando todas
            as regras do banco de questões forem
            atendidas.
          </p>
        </div>

        <form
          action={
            saveQuestionClassificationAction
          }
          className={styles.formRow}
        >
          <input
            type="hidden"
            name="questionId"
            value={question.id}
          />

          <label className={styles.field}>
            <span>
              Classificação em{" "}
              {question.discipline?.name ??
                "disciplina não definida"}
            </span>

            <select
              name="classification"
              defaultValue={
                currentChoice
              }
              className={styles.select}
              required
            >
              <option value="">
                Selecione um tópico ou subtópico
              </option>

              {topicGroups.map(
                (group) => (
                  <optgroup
                    key={group.name}
                    label={group.name}
                  >
                    {group.topics.flatMap(
                      (topic) => [
                        <option
                          key={topic.id}
                          value={encodeTopicChoice(
                            topic.id,
                          )}
                        >
                          {topic.name}
                        </option>,

                        ...topic.subtopics.map(
                          (subtopic) => (
                            <option
                              key={subtopic.id}
                              value={encodeSubtopicChoice(
                                subtopic.id,
                              )}
                            >
                              {SUBTOPIC_PREFIX}
                              {subtopic.name}
                            </option>
                          ),
                        ),
                      ],
                    )}
                  </optgroup>
                ),
              )}
            </select>
          </label>

          <button
            type="submit"
            className={styles.saveButton}
          >
            Salvar classificação
          </button>
        </form>

        {taxonomyTopics.length === 0 ? (
          <p className={styles.publishHint}>
            Esta disciplina ainda não possui
            tópicos ativos. Questões nas
            disciplinas antigas do ENEM aguardam
            reclassificação de disciplina.
          </p>
        ) : null}

        <form
          action={
            publishQuestionAction
          }
        >
          <input
            type="hidden"
            name="questionId"
            value={question.id}
          />

          <button
            type="submit"
            className={
              styles.publishButton
            }
            disabled={!canPublish}
          >
            Publicar questão
          </button>
        </form>

        {!canPublish ? (
          <p className={styles.publishHint}>
            Resolva as pendências abaixo para
            habilitar a publicação.
          </p>
        ) : (
          <p className={styles.publishHint}>
            A questão está pronta. Ao publicar,
            o gabarito será marcado como
            VERIFIED.
          </p>
        )}
      </section>

      <section className={styles.reviewBox}>
        <strong>
          Pendências para publicação
        </strong>

        {publicationIssues.length >
        0 ? (
          <ul>
            {publicationIssues.map(
              (issue) => (
                <li key={issue}>
                  {issueLabels[
                    issue
                  ]}
                </li>
              ),
            )}
          </ul>
        ) : (
          <p>
            Nenhuma pendência da política de
            publicação.
          </p>
        )}

        {!answerKeyIsReady ? (
          <p>
            O gabarito ainda não está
            definido.
          </p>
        ) : null}

        {!taxonomyIsValid &&
        question.topicId ? (
          <p>
            A classificação de tópico é
            inconsistente com a disciplina.
          </p>
        ) : null}
      </section>

      <section className={styles.meta}>
        {question.knowledgeArea ? (
          <span>
            Área:{" "}
            {question.knowledgeArea.name}
          </span>
        ) : null}

        <span>
          Disciplina:{" "}
          {question.discipline?.name ??
            "Não definida"}
        </span>

        <span>
          Classificação:{" "}
          {classificationPath ||
            "Não definida"}
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
              <p
                key={
                  link.supportContent.id
                }
              >
                {
                  link.supportContent
                    .content
                }
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
                      link.mediaAsset
                        .mimeType,

                    width:
                      link.mediaAsset
                        .width,

                    height:
                      link.mediaAsset
                        .height,

                    altText:
                      link.mediaAsset
                        .altText,

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
                      {
                        alternative.label
                      }
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
                      {
                        alternative.content
                      }
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