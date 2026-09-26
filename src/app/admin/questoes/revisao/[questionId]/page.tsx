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
import { removeMarkdownImages } from "@/shared/ui/inline-markdown";
import { RichText } from "@/shared/ui/rich-text";

import {
  QuestionMedia,
} from "@/app/app/questoes/_components/question-media";

import {
  encodeSubtopicChoice,
  encodeTopicChoice,
} from "@/modules/question-bank/presentation/question-classification-choice";
import {
  ANSWER_KEY_STATUS_LABELS,
  CLASSIFICATION_STATUS_LABELS,
  formatConfidence,
  labelFor,
  QUESTION_STATUS_LABELS,
  QUESTION_TYPE_LABELS,
} from "@/modules/question-bank/presentation/question-labels";

import {
  applyClassificationSuggestionAction,
  publishQuestionAction,
  saveQuestionClassificationAction,
} from "./actions";

import styles from "./page.module.css";

export const dynamic =
  "force-dynamic";

function readRationale(
  rawResult: unknown,
): string | null {
  if (
    !rawResult ||
    typeof rawResult !== "object" ||
    !("provider" in rawResult)
  ) {
    return null;
  }

  const provider =
    rawResult.provider;

  return provider &&
    typeof provider === "object" &&
    "rationale" in provider &&
    typeof provider.rationale === "string"
    ? provider.rationale.slice(0, 400)
    : null;
}

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
    "suggestion-unavailable":
      "A sugestão não está mais disponível ou já foi aplicada.",

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
        status: true,
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

  // Latest unapplied suggestion from the classification queue.
  const suggestion =
    await prisma.questionClassificationTask.findFirst({
      where: {
        questionId:
          question.id,
        status: {
          in: [
            "COMPLETED",
            "REVIEW_REQUIRED",
          ],
        },
        appliedAt:
          null,
      },

      orderBy: {
        createdAt:
          "desc",
      },

      select: {
        id: true,
        status: true,
        confidence: true,
        provider: true,
        model: true,
        suggestedTags: true,
        rawResult: true,
        suggestedDiscipline: {
          select: {
            name: true,
          },
        },
        suggestedArea: {
          select: {
            name: true,
          },
        },
        suggestedTopic: {
          select: {
            name: true,
          },
        },
        suggestedSubtopic: {
          select: {
            name: true,
          },
        },
      },
    });

  const suggestionPath =
    suggestion
      ? [
          suggestion.suggestedDiscipline?.name,
          suggestion.suggestedArea?.name,
          suggestion.suggestedTopic?.name,
          suggestion.suggestedSubtopic?.name,
        ]
          .filter(Boolean)
          .join(" \u203a ")
      : "";

  const suggestionRationale =
    readRationale(
      suggestion?.rawResult,
    );

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

  // Support texts that only held a (now separately rendered) image.
  const visibleSupportLinks =
    question.supportLinks.filter(
      (link) =>
        removeMarkdownImages(
          link.supportContent.content,
        ).length > 0,
    );

  const statusLabel =
    labelFor(
      QUESTION_STATUS_LABELS,
      question.status,
    );

  const answerKeyLabel =
    labelFor(
      ANSWER_KEY_STATUS_LABELS,
      question.answerKeyStatus,
    );

  const typeLabel =
    labelFor(
      QUESTION_TYPE_LABELS,
      question.type,
    );

  const suggestionStatusLabel =
    suggestion
      ? labelFor(
          CLASSIFICATION_STATUS_LABELS,
          suggestion.status,
        )
      : null;

  const suggestionConfidence =
    formatConfidence(
      suggestion?.confidence,
    );

  const examinationLine =
    question.examination
      ? [
          question.examination.title,
          question.examination.board?.acronym ??
            question.examination.board?.name,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

  // TOPIC_REQUIRED is already covered by the classification check.
  const remainingIssues =
    publicationIssues.filter(
      (issue) =>
        issue !== "TOPIC_REQUIRED",
    );

  const checklist = [
    {
      key: "classification",
      ok: taxonomyIsValid,
      label: taxonomyIsValid
        ? "Classificação com tópico válido"
        : question.topicId
          ? "Tópico inconsistente com a disciplina"
          : "Tópico ainda não definido",
    },
    {
      key: "answer-key",
      ok: answerKeyIsReady,
      label: answerKeyIsReady
        ? "Gabarito definido"
        : "Gabarito ainda não definido",
    },
    ...remainingIssues.map(
      (issue) => ({
        key: issue,
        ok: false,
        label: issueLabels[issue],
      }),
    ),
  ];

  return (
    <main className={styles.page}>
      <nav
        className={styles.breadcrumb}
        aria-label="Navegação estrutural"
      >
        <Link href="/admin/questoes/revisao">
          Revisão editorial
        </Link>
        <span aria-hidden="true">
          /
        </span>
        <span>
          Questão
        </span>
      </nav>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            Revisão editorial
          </p>

          <h1>
            Revisar questão
          </h1>

          {examinationLine ? (
            <p className={styles.subtitle}>
              {examinationLine}
            </p>
          ) : null}
        </div>

        <div className={styles.headerBadges}>
          <span
            className={`${styles.badge} ${styles[`tone_${statusLabel.tone}`]}`}
          >
            {statusLabel.label}
          </span>

          <span
            className={`${styles.badge} ${styles.tone_neutral}`}
          >
            {typeLabel.label}
          </span>
        </div>
      </header>

      {searchParams.saved === "1" ? (
        <div
          className={styles.noticeSuccess}
          role="status"
        >
          Classificação salva com sucesso.
        </div>
      ) : null}

      {searchParams.saved === "suggestion" ? (
        <div
          className={styles.noticeSuccess}
          role="status"
        >
          Sugestão aplicada. Confira a
          classificação antes de publicar.
        </div>
      ) : null}

      {errorMessage ? (
        <div
          className={styles.noticeError}
          role="alert"
        >
          {errorMessage}
        </div>
      ) : null}

      <div className={styles.layout}>
        <article className={styles.questionColumn}>
          <section
            className={`${styles.card} ${styles.facts}`}
            aria-label="Dados da questão"
          >
            <dl>
              <div>
                <dt>Área do conhecimento</dt>
                <dd>
                  {question.knowledgeArea?.name ??
                    "Não definida"}
                </dd>
              </div>

              <div>
                <dt>Disciplina</dt>
                <dd>
                  {question.discipline?.name ??
                    "Não definida"}
                </dd>
              </div>

              <div className={styles.factWide}>
                <dt>Classificação</dt>
                <dd>
                  {classificationPath ||
                    "Não definida"}
                </dd>
              </div>

              <div>
                <dt>Gabarito</dt>
                <dd>
                  <span
                    className={`${styles.badge} ${styles[`tone_${answerKeyLabel.tone}`]}`}
                  >
                    {answerKeyLabel.label}
                  </span>
                </dd>
              </div>
            </dl>
          </section>

          {visibleSupportLinks.length >
          0 ? (
            <section
              className={`${styles.card} ${styles.support}`}
              aria-label="Texto de apoio"
            >
              <h2 className={styles.sectionLabel}>
                Texto de apoio
              </h2>

              {visibleSupportLinks.map(
                (link) => (
                  <p
                    key={
                      link.supportContent.id
                    }
                  >
                    <RichText
                      text={
                        link.supportContent
                          .content
                      }
                    />
                  </p>
                ),
              )}
            </section>
          ) : null}

          <section
            className={`${styles.card} ${styles.question}`}
            aria-label="Questão"
          >
            <h2 className={styles.sectionLabel}>
              Enunciado
            </h2>

            <div className={styles.statement}>
              <RichText
                text={question.statement}
              />
            </div>

            <QuestionMedia
              media={questionMedia}
              fallbackAlt="Imagem da questão"
            />

            {question.alternatives.length >
            0 ? (
              <>
                <h2 className={styles.sectionLabel}>
                  Alternativas
                </h2>

                <ol className={styles.alternatives}>
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
                        <li
                          key={alternative.id}
                          className={`${styles.alternative} ${
                            alternative.isCorrect
                              ? styles.alternativeCorrect
                              : ""
                          }`}
                        >
                          <span
                            className={
                              styles.alternativeLetter
                            }
                            aria-hidden="true"
                          >
                            {alternative.label}
                          </span>

                          <div
                            className={
                              styles.alternativeBody
                            }
                          >
                            {alternative.content.trim() ? (
                              <p>
                                <RichText
                                  text={
                                    alternative.content
                                  }
                                />
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

                          {alternative.isCorrect ? (
                            <span
                              className={
                                styles.correctTag
                              }
                            >
                              Gabarito
                            </span>
                          ) : null}
                        </li>
                      );
                    },
                  )}
                </ol>
              </>
            ) : null}
          </section>
        </article>

        <aside className={styles.sidePanel}>
          {suggestion ? (
            <section
              className={`${styles.card} ${styles.suggestion}`}
            >
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>
                    Sugestão automática
                  </h2>

                  <p className={styles.cardMeta}>
                    {[
                      suggestion.provider ===
                      "rule-based"
                        ? "Regras"
                        : suggestion.provider,
                      suggestion.model,
                      suggestionConfidence
                        ? `confiança ${suggestionConfidence}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>

                {suggestionStatusLabel ? (
                  <span
                    className={`${styles.badge} ${styles[`tone_${suggestionStatusLabel.tone}`]}`}
                  >
                    {suggestionStatusLabel.label}
                  </span>
                ) : null}
              </div>

              <p className={styles.suggestionPath}>
                {suggestion.suggestedTopic
                  ? suggestionPath
                  : suggestion.suggestedDiscipline
                    ? `${suggestion.suggestedDiscipline.name} › tópico não identificado`
                    : "Nenhuma classificação identificada."}
              </p>

              {suggestion.provider ===
              "rule-based" ? (
                <p className={styles.suggestionRationale}>
                  Sugestão baseada em palavras-chave
                  do enunciado. Confira antes de
                  aplicar.
                </p>
              ) : suggestionRationale ? (
                <p className={styles.suggestionRationale}>
                  {suggestionRationale}
                </p>
              ) : null}

              {suggestion.suggestedTopic ? (
                <form
                  action={
                    applyClassificationSuggestionAction
                  }
                >
                  <input
                    type="hidden"
                    name="questionId"
                    value={question.id}
                  />

                  <input
                    type="hidden"
                    name="taskId"
                    value={suggestion.id}
                  />

                  <button
                    type="submit"
                    className={styles.secondaryButton}
                  >
                    Aplicar sugestão
                  </button>
                </form>
              ) : null}
            </section>
          ) : null}

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>
                  Classificação
                </h2>

                <p className={styles.cardMeta}>
                  Tópico ou subtópico de{" "}
                  {question.discipline?.name ??
                    "disciplina não definida"}
                </p>
              </div>
            </div>

            <form
              action={
                saveQuestionClassificationAction
              }
              className={styles.classificationForm}
            >
              <input
                type="hidden"
                name="questionId"
                value={question.id}
              />

              <label
                className={styles.field}
                htmlFor="classification"
              >
                <span className={styles.srOnly}>
                  Tópico ou subtópico
                </span>

                <select
                  id="classification"
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
                className={styles.secondaryButton}
              >
                Salvar classificação
              </button>
            </form>

            {taxonomyTopics.length === 0 ? (
              <p className={styles.hint}>
                Esta disciplina ainda não possui
                tópicos ativos. Questões nas
                disciplinas antigas do ENEM aguardam
                a definição da disciplina — use a
                sugestão automática quando houver.
              </p>
            ) : null}
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>
                  Publicação
                </h2>

                <p className={styles.cardMeta}>
                  {canPublish
                    ? "Tudo pronto para publicar."
                    : "Resolva os itens pendentes."}
                </p>
              </div>
            </div>

            <ul className={styles.checklist}>
              {checklist.map(
                (item) => (
                  <li
                    key={item.key}
                    className={
                      item.ok
                        ? styles.checkOk
                        : styles.checkPending
                    }
                  >
                    <span aria-hidden="true">
                      {item.ok
                        ? "✓"
                        : "!"}
                    </span>
                    {item.label}
                  </li>
                ),
              )}
            </ul>

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
                className={styles.publishButton}
                disabled={!canPublish}
              >
                Publicar questão
              </button>
            </form>

            <p className={styles.hint}>
              {canPublish
                ? "Ao publicar, a questão fica disponível para os alunos e o gabarito é marcado como verificado."
                : "A publicação segue sempre a política do banco de questões."}
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
