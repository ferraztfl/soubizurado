import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { formatQuestionCode } from "@/modules/question-bank/domain/question-code";
import {
  QUESTION_STATUS_LABELS,
  QUESTION_TYPE_LABELS,
  labelFor,
} from "@/modules/question-bank/presentation/question-labels";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import { QuestionEditForm } from "./question-edit-form";
import styles from "./editar.module.css";

type PageProps = Readonly<{
  params: Promise<{ questionId: string }>;
  searchParams: Promise<{ saved?: string }>;
}>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FIELD_LABELS: Readonly<Record<string, string>> = {
  statement: "Enunciado",
  alternatives: "Alternativas",
  answerKey: "Gabarito",
  created: "Criação",
  supportContent: "Texto de apoio",
  media: "Imagens",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export default async function EditQuestionPage(props: PageProps) {
  await requireAdminUser();

  const { questionId } = await props.params;
  const searchParams = await props.searchParams;

  if (!UUID_PATTERN.test(questionId)) {
    notFound();
  }

  const prisma = getPrismaClient();

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      publicNumber: true,
      type: true,
      status: true,
      statement: true,
      correctTrueFalse: true,
      updatedAt: true,
      discipline: { select: { name: true } },
      area: { select: { name: true } },
      topic: { select: { name: true } },
      subtopic: { select: { name: true } },
      examination: {
        select: { title: true, year: true, board: { select: { name: true, acronym: true } } },
      },
      alternatives: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          label: true,
          content: true,
          isCorrect: true,
          mediaLinks: {
            orderBy: { position: "asc" },
            select: { mediaAsset: { select: { id: true, altText: true } } },
          },
        },
      },
      revisions: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          reason: true,
          changedFields: true,
          answerKeyChanged: true,
          createdAt: true,
          editor: { select: { displayName: true } },
        },
      },
    },
  });

  if (!question || question.status === "ARCHIVED") {
    notFound();
  }

  const status = labelFor(QUESTION_STATUS_LABELS, question.status);
  const type = labelFor(QUESTION_TYPE_LABELS, question.type);
  const isInReview = question.status === "IN_REVIEW";
  const isPublished = question.status === "PUBLISHED";

  const board = question.examination?.board?.acronym ?? question.examination?.board?.name ?? null;
  const classification = [
    question.discipline?.name,
    question.area?.name,
    question.topic?.name,
    question.subtopic?.name,
  ]
    .filter(Boolean)
    .join(" › ");

  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Navegação estrutural">
        <Link href="/admin/questoes/revisao">Revisão editorial</Link>
        <span aria-hidden="true">/</span>
        {isInReview ? (
          <>
            <Link href={`/admin/questoes/revisao/${question.id}`}>Questão</Link>
            <span aria-hidden="true">/</span>
          </>
        ) : null}
        <span>Editar</span>
      </nav>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Banco de questões</p>
          <h1>Editar questão {formatQuestionCode(question.publicNumber)}</h1>
          {question.examination ? (
            <p className={styles.subtitle}>
              {[question.examination.title, board].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>

        <div className={styles.headerBadges}>
          <span className={`${styles.badge} ${styles[`tone_${status.tone}`]}`}>{status.label}</span>
          <span className={`${styles.badge} ${styles.tone_neutral}`}>{type.label}</span>
        </div>
      </header>

      {searchParams.saved === "1" ? (
        <div className={styles.noticeSuccess} role="status">
          Alterações salvas e registradas no histórico.
        </div>
      ) : null}

      {isPublished ? (
        <div className={styles.noticeWarning}>
          Esta questão está publicada: as alterações aparecem para os alunos assim que forem salvas.
        </div>
      ) : null}

      <div className={styles.layout}>
        <QuestionEditForm
          questionId={question.id}
          updatedAt={question.updatedAt.toISOString()}
          type={question.type}
          isPublished={isPublished}
          statement={question.statement}
          correctTrueFalse={question.correctTrueFalse}
          alternatives={question.alternatives.map((alternative) => ({
            id: alternative.id,
            label: alternative.label,
            content: alternative.content,
            isCorrect: alternative.isCorrect,
            images: alternative.mediaLinks.map((link) => ({
              id: link.mediaAsset.id,
              url: `/api/media/${link.mediaAsset.id}`,
              alt: link.mediaAsset.altText ?? `Imagem da alternativa ${alternative.label}`,
            })),
          }))}
        />

        <aside className={styles.sidePanel}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Classificação</h2>
            <p className={styles.hint}>{classification || "Ainda não classificada."}</p>
            {isInReview ? (
              <Link className={styles.secondaryLink} href={`/admin/questoes/revisao/${question.id}`}>
                Alterar na revisão editorial
              </Link>
            ) : (
              <p className={styles.hint}>
                A troca de classificação de questões publicadas chega na próxima etapa.
              </p>
            )}
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Histórico de alterações</h2>
            {question.revisions.length === 0 ? (
              <p className={styles.hint}>Nenhuma edição manual registrada.</p>
            ) : (
              <ol className={styles.history}>
                {question.revisions.map((revision) => (
                  <li key={revision.id}>
                    <p className={styles.historyMeta}>
                      {dateFormatter.format(revision.createdAt)} ·{" "}
                      {revision.editor?.displayName ?? "Administrador"}
                    </p>
                    <p className={styles.historyFields}>
                      {revision.changedFields.map((field) => FIELD_LABELS[field] ?? field).join(", ")}
                      {revision.answerKeyChanged ? (
                        <span className={styles.keyChanged}>gabarito alterado</span>
                      ) : null}
                    </p>
                    <p className={styles.historyReason}>{revision.reason}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
