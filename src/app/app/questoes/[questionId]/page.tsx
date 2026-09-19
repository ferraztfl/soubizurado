import Link from "next/link";
import { notFound } from "next/navigation";

import {
  createGetPublishedQuestionByIdUseCase,
} from "@/modules/question-bank/infrastructure/composition/question-bank-application";
import { ApplicationError } from "@/shared/errors/application-error";
import { ERROR_CODES } from "@/shared/errors/error-code";
import { PageHeader } from "@/shared/ui/page-header";

import styles from "./question-detail.module.css";

type QuestionDetailPageProps = Readonly<{
  params: Promise<{
    questionId: string;
  }>;
}>;

export default async function QuestionDetailPage({
  params,
}: QuestionDetailPageProps) {
  const { questionId } = await params;
  const getQuestion =
    createGetPublishedQuestionByIdUseCase();

  let question;

  try {
    question = await getQuestion.execute(
      questionId,
    );
  } catch (error) {
    if (
      error instanceof ApplicationError &&
      error.code === ERROR_CODES.NOT_FOUND
    ) {
      notFound();
    }

    throw error;
  }

  const board =
    question.examination?.board?.acronym ??
    question.examination?.board?.name ??
    null;

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Banco de questões"
        title="Resolver questão"
        description="Leia o enunciado e as alternativas. O gabarito permanece isolado até a etapa de resposta."
        actions={
          <Link
            href="/app/questoes"
            className={styles.back}
          >
            Voltar para questões
          </Link>
        }
      />

      <section className={styles.layout}>
        <article className={styles.question}>
          <div className={styles.meta}>
            <span className={styles.type}>
              {question.type === "MULTIPLE_CHOICE"
                ? "Múltipla escolha"
                : "Certo / Errado"}
            </span>

            <span>
              {question.classification.discipline.name}
            </span>

            {question.examination?.year ? (
              <span>
                {question.examination.year}
              </span>
            ) : null}

            {board ? <span>{board}</span> : null}
          </div>

          <div className={styles.statement}>
            {question.statement}
          </div>

          {question.type === "MULTIPLE_CHOICE" ? (
            <div
              className={styles.alternatives}
              aria-label="Alternativas"
            >
              {question.alternatives.map(
                (alternative) => (
                  <div
                    key={alternative.id}
                    className={styles.alternative}
                  >
                    <span
                      className={styles.label}
                      aria-hidden="true"
                    >
                      {alternative.label}
                    </span>

                    <span>
                      {alternative.content}
                    </span>
                  </div>
                ),
              )}
            </div>
          ) : (
            <div
              className={styles.trueFalse}
              aria-label="Opções de julgamento"
            >
              <div className={styles.alternative}>
                <span
                  className={styles.label}
                  aria-hidden="true"
                >
                  C
                </span>
                <span>Certo</span>
              </div>

              <div className={styles.alternative}>
                <span
                  className={styles.label}
                  aria-hidden="true"
                >
                  E
                </span>
                <span>Errado</span>
              </div>
            </div>
          )}

          <div className={styles.pendingAction}>
            <strong>
              Resposta interativa na próxima etapa
            </strong>
            <p>
              A tela já usa somente os dados públicos da questão. O envio da
              resposta será conectado ao módulo Study sem expor o gabarito no
              navegador.
            </p>
          </div>
        </article>

        <aside className={styles.context}>
          <span className={styles.contextEyebrow}>
            Classificação
          </span>

          <dl className={styles.details}>
            <div>
              <dt>Disciplina</dt>
              <dd>
                {question.classification.discipline.name}
              </dd>
            </div>

            <div>
              <dt>Assunto</dt>
              <dd>
                {question.classification.topic.name}
              </dd>
            </div>

            {question.classification.subtopic ? (
              <div>
                <dt>Subassunto</dt>
                <dd>
                  {question.classification.subtopic.name}
                </dd>
              </div>
            ) : null}

            {question.examination ? (
              <div>
                <dt>Prova</dt>
                <dd>
                  {question.examination.title}
                </dd>
              </div>
            ) : null}

            {board ? (
              <div>
                <dt>Banca</dt>
                <dd>{board}</dd>
              </div>
            ) : null}
          </dl>
        </aside>
      </section>
    </div>
  );
}
