import Link from "next/link";

import type { PublicQuestionDto } from "@/modules/question-bank/application/dto/public-question";
import { buildQuestionExplorerHref } from "@/modules/question-bank/presentation/question-explorer-search-params";
import type { AnsweredQuestionStatus } from "@/modules/study/infrastructure/queries/answered-question-status";
import { removeMarkdownImages } from "@/shared/ui/inline-markdown";
import { RichText } from "@/shared/ui/rich-text";

import { QuestionAnswerPanel } from "../[questionId]/_components/question-answer-panel";

import { QuestionMedia } from "./question-media";
import styles from "./question-list-item.module.css";

type QuestionListItemProps = Readonly<{
  question: PublicQuestionDto;
  /** 1-based position in the result list (across pages). */
  position: number;
  status: AnsweredQuestionStatus | null;
}>;

/**
 * A full, answerable question inside the explorer list: header with the
 * public code and classification, exam facts that act as filters, the
 * shared text (collapsible), the statement and the answer panel.
 */
export function QuestionListItem({ question, position, status }: QuestionListItemProps) {
  const board = question.examination?.board ?? null;
  const supports = question.supportContents.filter(
    (support) => removeMarkdownImages(support.content).length > 0,
  );
  const { discipline, area, topic, subtopic } = question.classification;
  // Tópico and Subtópico filter the list (within the Matéria); Detalhe is text only.
  const crumbs: ReadonlyArray<{ key: string; name: string; href?: string }> = [
    ...(area
      ? [{ key: "area", name: area.name, href: buildQuestionExplorerHref({ disciplineId: discipline.id, areaId: area.id }) }]
      : []),
    {
      key: "topic",
      name: topic.name,
      ...(area
        ? { href: buildQuestionExplorerHref({ disciplineId: discipline.id, areaId: area.id, topicId: topic.id }) }
        : {}),
    },
    ...(subtopic ? [{ key: "subtopic", name: subtopic.name }] : []),
  ];

  return (
    <article className={styles.item} aria-labelledby={`q-${question.code}`}>
      <header className={styles.head}>
        <span className={styles.position}>{position}</span>

        <Link id={`q-${question.code}`} href={`/app/questoes/${question.code}`} className={styles.code}>
          {question.code}
        </Link>

        <p className={styles.crumbs}>
          <Link href={buildQuestionExplorerHref({ disciplineId: discipline.id })}>{discipline.name}</Link>
          {crumbs.map((crumb) => (
            <span key={crumb.key}>
              <span className={styles.separator} aria-hidden="true">
                ›
              </span>
              {crumb.href ? (
                <Link href={crumb.href} className={styles.crumbLink}>
                  {crumb.name}
                </Link>
              ) : (
                crumb.name
              )}
            </span>
          ))}
        </p>

        {status ? (
          <span className={status.lastIsCorrect ? styles.statusRight : styles.statusWrong}>
            {status.lastIsCorrect ? "✓ Resolvida · acertou" : "Resolvida · errou"}
          </span>
        ) : null}
      </header>

      <dl className={styles.facts}>
        {question.examination?.year ? (
          <div>
            <dt>Ano:</dt>
            <dd>
              <Link href={buildQuestionExplorerHref({ year: question.examination.year })}>
                {question.examination.year}
              </Link>
            </dd>
          </div>
        ) : null}

        {board ? (
          <div>
            <dt>Banca:</dt>
            <dd>
              <Link href={buildQuestionExplorerHref({ boardId: board.id })}>{board.name}</Link>
            </dd>
          </div>
        ) : null}

        {question.examination ? (
          <div className={styles.examFact}>
            <dt>Prova:</dt>
            <dd>{question.examination.title}</dd>
          </div>
        ) : null}

        <div>
          <dt className={styles.srOnly}>Tipo:</dt>
          <dd className={styles.type}>
            {question.type === "MULTIPLE_CHOICE" ? "Múltipla escolha" : "Certo / Errado"}
          </dd>
        </div>
      </dl>

      <div className={styles.body}>
        {supports.length > 0 ? (
          <details className={styles.support} open>
            <summary>Texto de apoio</summary>
            {supports.map((support) => (
              <p key={support.id}>
                <RichText text={support.content} />
              </p>
            ))}
          </details>
        ) : null}

        <div className={styles.statement}>
          <RichText text={question.statement} />
        </div>

        <QuestionMedia media={question.media} fallbackAlt={`Imagem da questão ${question.code}`} />

        <QuestionAnswerPanel question={question} compact />
      </div>
    </article>
  );
}
