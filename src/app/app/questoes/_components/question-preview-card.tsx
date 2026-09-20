import Link from "next/link";

import type {
  PublicQuestionDto,
} from "@/modules/question-bank/application/dto/public-question";

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
    <article className={styles.card}>
      <div className={styles.meta}>
        <span className={styles.type}>
          {questionTypeLabel(question.type)}
        </span>

        <span className={styles.discipline}>
          {question.classification.discipline.name}
        </span>

        {primaryExamination?.year ? (
          <span>{primaryExamination.year}</span>
        ) : null}

        {board ? <span>{board}</span> : null}

        {question.occurrences.length > 1 ? (
          <span>
            +{question.occurrences.length - 1} ocorrência(s)
          </span>
        ) : null}
      </div>

      <h2>{question.statement}</h2>

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
