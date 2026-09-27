import Link from "next/link";
import { notFound } from "next/navigation";

import type {
  PublicQuestionDto,
} from "@/modules/question-bank/application/dto/public-question";
import {
  createGetPublishedQuestionByIdUseCase,
} from "@/modules/question-bank/infrastructure/composition/question-bank-application";
import { findStudentProfileId } from "@/modules/study/infrastructure/queries/answered-question-status";
import {
  EMPTY_QUESTION_STUDY_TOOLS,
  loadQuestionStudyTools,
} from "@/modules/study/infrastructure/queries/question-study-tools";
import { ApplicationError } from "@/shared/errors/application-error";
import { ERROR_CODES } from "@/shared/errors/error-code";
import { PageHeader } from "@/shared/ui/page-header";
import { removeMarkdownImages } from "@/shared/ui/inline-markdown";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";
import { RichText } from "@/shared/ui/rich-text";

import { QuestionMedia } from "../_components/question-media";
import { QuestionStudyTools } from "../_components/question-study-tools";
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

  // The student's favorite / note / open report for this question.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profileId = user ? await findStudentProfileId(user.id) : null;
  const tools = profileId
    ? ((await loadQuestionStudyTools(profileId, [question.id])).get(question.id) ?? EMPTY_QUESTION_STUDY_TOOLS)
    : EMPTY_QUESTION_STUDY_TOOLS;

  // Support texts that only held an image rendered by QuestionMedia.
  const visibleSupportContents =
    question.supportContents.filter(
      (support) =>
        removeMarkdownImages(support.content).length > 0,
    );

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
            <span className={styles.code}>{question.code}</span>

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

          {visibleSupportContents.length > 0 ? (
            <section
              className={styles.supportContent}
              aria-label="Texto de apoio"
            >
              <span className={styles.supportLabel}>
                Texto de apoio
              </span>

              {visibleSupportContents.map(
                (support) => (
                  <p key={support.id}>
                    <RichText
                      text={support.content}
                    />
                  </p>
                ),
              )}
            </section>
          ) : null}

          <div className={styles.statement}>
            <RichText
              text={question.statement}
            />
          </div>

          <QuestionMedia
            media={question.media}
            fallbackAlt="Imagem da questao"
          />

          <QuestionAnswerPanel
            question={question}
          />

          <QuestionStudyTools questionId={question.id} code={question.code} initial={tools} />
        </article>

        <aside className={styles.context}>
          <span className={styles.contextEyebrow}>
            Classificação
          </span>

          <dl className={styles.details}>
            <div>
              <dt>Matéria</dt>
              <dd>
                {question.classification.discipline.name}
              </dd>
            </div>

            {question.classification.area ? (
              <div>
                <dt>Tópico</dt>
                <dd>
                  {question.classification.area.name}
                </dd>
              </div>
            ) : null}

            <div>
              <dt>Subtópico</dt>
              <dd>
                {question.classification.topic.name}
              </dd>
            </div>

            {question.classification.subtopic ? (
              <div>
                <dt>Detalhe</dt>
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
