import Link from "next/link";

import type {
  PublicQuestionDto,
} from "@/modules/question-bank/application/dto/public-question";

import { QuestionMedia } from "./question-media";

import styles from "./question-preview-card.module.css";

type QuestionPreviewCardProps = Readonly<{
  question: PublicQuestionDto;
}>;

function questionTypeLabel(
  type: PublicQuestionDto["type"],
): string {
  return type === "MULTIPLE_CHOICE"
    ? "Múltipla escolha"
    : "Certo / Errado";
}

export function QuestionPreviewCard({
  question,
}: QuestionPreviewCardProps) {
  const board =
    question.examination?.board?.acronym ??
    question.examination?.board?.name ??
    null;

  const previewMedia =
    (question.media ?? [])
      .filter((media) =>
        media.mimeType.startsWith(
          "image/",
        ),
      )
      .slice(
        0,
        1,
      );

  return (
    <article className={styles.card}>
      <div className={styles.meta}>
        <span className={styles.type}>
          {questionTypeLabel(question.type)}
        </span>

        <span className={styles.discipline}>
          {question.classification.discipline.name}
        </span>

        {question.examination?.year ? (
          <span>{question.examination.year}</span>
        ) : null}

        {board ? <span>{board}</span> : null}
      </div>

      <h2>{question.statement}</h2>

      <QuestionMedia
        media={previewMedia}
        variant="compact"
        fallbackAlt="Imagem da questao"
      />

      <div className={styles.taxonomy}>
        <span>
          {question.classification.topic.name}
        </span>

        {question.classification.subtopic ? (
          <>
            <span aria-hidden="true">/</span>
            <span>
              {question.classification.subtopic.name}
            </span>
          </>
        ) : null}
      </div>

      <footer className={styles.footer}>
        <span>
          {question.type === "MULTIPLE_CHOICE"
            ? `${question.alternatives.length} alternativas`
            : "Julgamento de item"}
        </span>

        <Link
          href={`/app/questoes/${question.id}`}
          className={styles.open}
        >
          Abrir questão
        </Link>
      </footer>
    </article>
  );
}
