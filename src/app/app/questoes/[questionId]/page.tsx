import Link from "next/link";
import { notFound } from "next/navigation";

import type {
  PublicQuestionDto,
} from "@/modules/question-bank/application/dto/public-question";
import {
  createGetPublishedQuestionByIdUseCase,
} from "@/modules/question-bank/infrastructure/composition/question-bank-application";
import { ApplicationError } from "@/shared/errors/application-error";
import { ERROR_CODES } from "@/shared/errors/error-code";
import { PageHeader } from "@/shared/ui/page-header";

import { QuestionAnswerPanel } from "./_components/question-answer-panel";

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

  let question: PublicQuestionDto;

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

  const primaryOccurrence =
    question.occurrences[0] ?? null;

  const primaryExamination =
    primaryOccurrence?.examination ??
    question.examination;

  const board =
    primaryExamination?.board?.acronym ??
    primaryExamination?.board?.name ??
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

            {primaryExamination?.year ? (
              <span>
                {primaryExamination.year}
              </span>
            ) : null}

            {board ? <span>{board}</span> : null}
          </div>

          {question.supportContents.length > 0 ? (
            <section
              className={styles.supportContent}
              aria-label="Texto de apoio"
            >
              <span className={styles.supportLabel}>
                Texto de apoio
              </span>

              {question.supportContents.map(
                (support) => (
                  <p key={support.id}>
                    {support.content}
                  </p>
                ),
              )}
            </section>
          ) : null}

          <div className={styles.statement}>
            {question.statement}
          </div>

          <QuestionAnswerPanel
            question={question}
          />
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

            {question.occurrences.length > 0 ? (
              <div>
                <dt>Ocorrências em provas</dt>
                <dd>
                  {question.occurrences.map(
                    (occurrence, index) => {
                      const occurrenceBoard =
                        occurrence.examination
                          ?.board?.acronym ??
                        occurrence.examination
                          ?.board?.name ??
                        "Banca não informada";

                      return (
                        <span
                          key={occurrence.id}
                        >
                          {index > 0 ? (
                            <br />
                          ) : null}
                          {
                            occurrence.source
                              .name
                          }
                          {" · "}
                          {occurrenceBoard}
                          {occurrence.examination
                            ?.year
                            ? ` · ${occurrence.examination.year}`
                            : ""}
                          {occurrence
                            .externalQuestionNumber
                            ? ` · questão ${occurrence.externalQuestionNumber}`
                            : ""}
                          {occurrence.examination
                            ?.title
                            ? ` · ${occurrence.examination.title}`
                            : ""}
                        </span>
                      );
                    },
                  )}
                </dd>
              </div>
            ) : question.examination ? (
              <>
                <div>
                  <dt>Prova</dt>
                  <dd>
                    {question.examination.title}
                  </dd>
                </div>
                {board ? (
                  <div>
                    <dt>Banca</dt>
                    <dd>{board}</dd>
                  </div>
                ) : null}
              </>
            ) : null}
          </dl>
        </aside>
      </section>
    </div>
  );
}
