import Link from "next/link";

import { buildQuestionExplorerHref } from "@/modules/question-bank/presentation/question-explorer-search-params";
import type { TopicPerformance } from "@/modules/study/infrastructure/queries/student-performance";

import styles from "./attention-card.module.css";

type AttentionCardProps = Readonly<{
  hasAnswers: boolean;
  wrongQuestions: number;
  weakestTopic: TopicPerformance | null;
  favorites: number;
}>;

type Item = Readonly<{ title: string; detail: string; href: string | null }>;

/** Where to focus: wrong questions, the weakest topic and saved questions. */
export function AttentionCard({ hasAnswers, wrongQuestions, weakestTopic, favorites }: AttentionCardProps) {
  const waiting = "Aguardando dados de estudo";
  const items: Item[] = [
    {
      title: "Erros para refazer",
      detail: !hasAnswers
        ? waiting
        : wrongQuestions === 0
          ? "Nenhum erro até agora"
          : `${wrongQuestions} ${wrongQuestions === 1 ? "questão errada" : "questões erradas"}`,
      href: wrongQuestions > 0 ? buildQuestionExplorerHref({ situation: "erradas" }) : null,
    },
    {
      title: "Assunto com menor precisão",
      detail: !hasAnswers
        ? waiting
        : weakestTopic
          ? `${weakestTopic.name} · ${Math.round((weakestTopic.correct / weakestTopic.attempts) * 100)}% de acerto`
          : "Responda mais questões por tópico",
      href: weakestTopic
        ? buildQuestionExplorerHref({
            disciplineId: weakestTopic.disciplineId,
            areaId: weakestTopic.areaId,
            situation: "erradas",
          })
        : null,
    },
    {
      title: "Questões favoritas",
      detail: favorites === 0 ? "Marque com ☆ as que quiser rever" : `${favorites} salvas para revisar`,
      href: favorites > 0 ? buildQuestionExplorerHref({ situation: "favoritas" }) : null,
    },
  ];

  return (
    <article className={styles.card}>
      <span className={styles.eyebrow}>
        Pontos de atenção
      </span>

      <h2>Onde focar agora</h2>

      <p className={styles.description}>
        {hasAnswers
          ? "Atalhos para revisar o que você errou e os assuntos em que tem mais dificuldade."
          : "Depois das primeiras respostas, mostraremos aqui os assuntos que mais precisam de revisão."}
      </p>

      <div className={styles.items}>
        {items.map((item) => {
          const content = (
            <>
              <span className={styles.dot} aria-hidden="true" />

              <div>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </div>
            </>
          );

          return item.href ? (
            <Link key={item.title} href={item.href} className={`${styles.item} ${styles.itemLink}`}>
              {content}
            </Link>
          ) : (
            <div key={item.title} className={styles.item}>
              {content}
            </div>
          );
        })}
      </div>
    </article>
  );
}
