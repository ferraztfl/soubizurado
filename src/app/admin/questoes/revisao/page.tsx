import Link from "next/link";

import {
  requireEditorialUser,
} from "@/modules/identity/infrastructure/authorization/require-editorial-user";
import {
  createListQuestionsForReviewUseCase,
} from "@/modules/question-bank/infrastructure/composition/question-bank-application";
import {
  assignQuestionTopicAction,
  publishQuestionAction,
} from "@/modules/question-bank/presentation/actions/question-review-actions";
import {
  PageHeader,
} from "@/shared/ui/page-header";

import styles from "./review-queue.module.css";

type ReviewQueuePageProps = Readonly<{
  searchParams: Promise<
    Readonly<{
      updated?: string;
      error?: string;
    }>
  >;
}>;

function statusMessage(
  updated: string | undefined,
): string | null {
  if (updated === "topic") {
    return "Tópico atualizado. A questão continua em revisão até a publicação.";
  }

  if (updated === "published") {
    return "Questão publicada e liberada no banco público.";
  }

  return null;
}

function errorMessage(
  error: string | undefined,
): string | null {
  if (error === "VALIDATION_ERROR") {
    return "A operação não pôde ser concluída porque ainda há dados obrigatórios ausentes ou inválidos.";
  }

  if (error === "NOT_FOUND") {
    return "A questão não está mais disponível na fila de revisão.";
  }

  if (error === "CONFLICT") {
    return "O estado da questão mudou antes da conclusão da operação. Atualize a página e tente novamente.";
  }

  return error
    ? "Não foi possível concluir a operação."
    : null;
}

function formatQuestionType(
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE",
): string {
  return type === "TRUE_FALSE"
    ? "Certo ou errado"
    : "Múltipla escolha";
}


function formatAnswerKeyStatus(
  status: "MISSING" | "DEFINED" | "VERIFIED",
): string {
  if (status === "VERIFIED") {
    return "Gabarito verificado";
  }

  if (status === "DEFINED") {
    return "Gabarito definido";
  }

  return "Sem gabarito";
}

export default async function ReviewQueuePage({
  searchParams,
}: ReviewQueuePageProps) {
  const [editorialUser, params] =
    await Promise.all([
      requireEditorialUser(),
      searchParams,
    ]);

  const questions =
    await createListQuestionsForReviewUseCase().execute();

  const withoutTopic =
    questions.filter(
      (question) =>
        question.topic === null,
    ).length;
  const withTopic =
    questions.length - withoutTopic;

  const success =
    statusMessage(params.updated);
  const error =
    errorMessage(params.error);

  return (
    <main className={styles.page}>
      <div className={styles.topbar}>
        <Link
          href="/app"
          className={styles.backLink}
        >
          ← Voltar ao aplicativo
        </Link>

        <span className={styles.user}>
          {editorialUser.displayName}
        </span>
      </div>

      <PageHeader
        eyebrow="Administração editorial"
        title="Revisão de questões"
        description="Classifique a taxonomia das questões importadas e publique somente o conteúdo que estiver completo."
      />

      {success ? (
        <div
          className={styles.success}
          role="status"
        >
          {success}
        </div>
      ) : null}

      {error ? (
        <div
          className={styles.error}
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <section
        className={styles.metrics}
        aria-label="Resumo da fila"
      >
        <article className={styles.metric}>
          <span>Em revisão</span>
          <strong>{questions.length}</strong>
        </article>

        <article className={styles.metric}>
          <span>Sem tópico</span>
          <strong>{withoutTopic}</strong>
        </article>

        <article className={styles.metric}>
          <span>Com tópico</span>
          <strong>{withTopic}</strong>
        </article>
      </section>

      <section
        className={styles.queue}
        aria-labelledby="review-queue-title"
      >
        <header className={styles.queueHeader}>
          <div>
            <span className={styles.eyebrow}>
              Fila editorial
            </span>
            <h2 id="review-queue-title">
              Questões aguardando revisão
            </h2>
          </div>

          <span className={styles.count}>
            Até 100 itens por vez
          </span>
        </header>

        {questions.length === 0 ? (
          <div className={styles.empty}>
            <strong>
              Nenhuma questão em revisão.
            </strong>
            <p>
              Novas importações aparecerão aqui antes de serem publicadas.
            </p>
          </div>
        ) : (
          <div className={styles.cards}>
            {questions.map((question) => {
              const canPublish =
                question.topic !== null;

              return (
                <article
                  key={question.id}
                  className={styles.card}
                >
                  <div
                    className={styles.cardMeta}
                  >
                    <span
                      className={styles.badge}
                    >
                      {formatQuestionType(
                        question.type,
                      )}
                    </span>
                    <span>
                      {formatAnswerKeyStatus(
                        question.answerKeyStatus,
                      )}
                    </span>
                    {question.occurrences[0]
                      ?.examination ? (
                      <span>
                        {question.occurrences[0]
                          .examination.board ??
                          "Banca não informada"}
                        {question.occurrences[0]
                          .examination.year
                          ? ` · ${question.occurrences[0].examination.year}`
                          : ""}
                        {question.occurrences
                          .length > 1
                          ? ` · +${question.occurrences.length - 1} ocorrência(s)`
                          : ""}
                      </span>
                    ) : null}
                  </div>

                  <p
                    className={
                      styles.statement
                    }
                  >
                    {question.statement}
                  </p>

                  <dl
                    className={
                      styles.taxonomy
                    }
                  >
                    <div>
                      <dt>Disciplina</dt>
                      <dd>
                        {question.discipline
                          ?.name ??
                          "Não informada"}
                      </dd>
                    </div>
                    <div>
                      <dt>Tópico atual</dt>
                      <dd>
                        {question.topic
                          ?.name ??
                          "Ainda não classificado"}
                      </dd>
                    </div>
                  </dl>

                  <section
                    className={
                      styles.provenance
                    }
                    aria-label="Ocorrências e proveniência"
                  >
                    <span
                      className={
                        styles.provenanceLabel
                      }
                    >
                      Ocorrências em provas
                    </span>

                    {question.occurrences.length >
                    0 ? (
                      <ul
                        className={
                          styles.occurrenceList
                        }
                      >
                        {question.occurrences.map(
                          (occurrence) => (
                            <li
                              key={
                                occurrence.id
                              }
                            >
                              <strong>
                                {
                                  occurrence
                                    .sourceName
                                }
                              </strong>
                              {" · "}
                              {occurrence
                                .examination
                                ?.board ??
                                "Banca não informada"}
                              {occurrence
                                .examination
                                ?.year
                                ? ` · ${occurrence.examination.year}`
                                : ""}
                              {occurrence
                                .externalQuestionNumber
                                ? ` · questão ${occurrence.externalQuestionNumber}`
                                : ""}
                              {occurrence
                                .examination
                                ?.title
                                ? ` · ${occurrence.examination.title}`
                                : ""}
                            </li>
                          ),
                        )}
                      </ul>
                    ) : (
                      <p
                        className={
                          styles.noProvenance
                        }
                      >
                        Nenhuma ocorrência de prova registrada.
                      </p>
                    )}
                  </section>

                  <div
                    className={styles.actions}
                  >
                    <form
                      action={
                        assignQuestionTopicAction
                      }
                      className={
                        styles.topicForm
                      }
                    >
                      <input
                        type="hidden"
                        name="questionId"
                        value={question.id}
                      />

                      <label>
                        <span>
                          Classificar tópico
                        </span>
                        <input
                          name="topicName"
                          type="text"
                          minLength={2}
                          maxLength={180}
                          required
                          defaultValue={
                            question.topic
                              ?.name ?? ""
                          }
                          placeholder="Ex.: Nutrição clínica"
                        />
                      </label>

                      <button type="submit">
                        Salvar tópico
                      </button>
                    </form>

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
                        disabled={
                          !canPublish
                        }
                        title={
                          canPublish
                            ? "Publicar questão"
                            : "Defina um tópico antes de publicar"
                        }
                      >
                        Publicar
                      </button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
