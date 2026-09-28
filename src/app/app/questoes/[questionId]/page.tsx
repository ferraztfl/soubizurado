import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
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
import { hasVisibleContent, removeMarkdownImages, stripInlineMarkdown } from "@/shared/ui/inline-markdown";
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

/** One load per request, shared by the metadata and the page. */
const loadPublishedQuestion = cache(async (questionId: string): Promise<PublicQuestionDto | null> => {
  try {
    return await createGetPublishedQuestionByIdUseCase().execute(questionId);
  } catch (error) {
    if (error instanceof ApplicationError && error.code === ERROR_CODES.NOT_FOUND) {
      return null;
    }
    throw error;
  }
});

export async function generateMetadata({ params }: QuestionDetailPageProps): Promise<Metadata> {
  const question = await loadPublishedQuestion((await params).questionId);

  if (!question) {
    return { title: "Questão não encontrada", robots: { index: false } };
  }

  const board = question.examination?.board?.acronym ?? question.examination?.board?.name;
  const origin = question.isOriginal ? "Questão inédita" : [board, question.examination?.year].filter(Boolean).join(" ");
  const text = stripInlineMarkdown(removeMarkdownImages(question.statement)).replace(/\s+/g, " ").trim();

  return {
    title: [`${question.code} · ${question.classification.discipline.name}`, origin].filter(Boolean).join(" · "),
    description: text.length > 155 ? `${text.slice(0, 152).trimEnd()}…` : text,
    alternates: { canonical: `/questoes/${question.code}` },
  };
}

export default async function QuestionDetailPage({
  params,
}: QuestionDetailPageProps) {
  const { questionId } = await params;
  const question = await loadPublishedQuestion(questionId);

  if (!question) {
    notFound();
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

  // Skip support texts with nothing to show (e.g. an image without a local copy).
  const visibleSupportContents =
    question.supportContents.filter(
      (support) => hasVisibleContent(support.content, question.textImages),
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

            {question.isOriginal ? (
              <span className={styles.original}>Questão inédita</span>
            ) : null}

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
                      images={question.textImages}
                    />
                  </p>
                ),
              )}
            </section>
          ) : null}

          <div className={styles.statement}>
            <RichText
              text={question.statement}
              images={question.textImages}
            />
          </div>

          <QuestionMedia
            media={question.media}
            fallbackAlt="Imagem da questao"
          />

          <QuestionAnswerPanel
            question={question}
          />

          {user ? (
            <QuestionStudyTools questionId={question.id} code={question.code} initial={tools} />
          ) : (
            <p className={styles.visitorTools}>
              <Link href="/cadastro">Crie sua conta grátis</Link> para responder 10 questões por dia, favoritar e
              anotar.
            </p>
          )}
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
