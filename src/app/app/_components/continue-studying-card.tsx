import Link from "next/link";

import { buildQuestionExplorerHref } from "@/modules/question-bank/presentation/question-explorer-search-params";

import styles from "./continue-studying-card.module.css";

type ContinueStudyingCardProps = Readonly<{
  /** Discipline of the latest answer; null before the first one. */
  lastActivity: Readonly<{ disciplineId: string; disciplineName: string; answeredAt: Date }> | null;
}>;

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

export function ContinueStudyingCard({ lastActivity }: ContinueStudyingCardProps) {
  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>
            Continue estudando
          </span>

          <h2>Sua próxima sessão começa aqui</h2>
        </div>

        <span className={styles.status}>
          {lastActivity ? `Último estudo: ${dateFormatter.format(lastActivity.answeredAt)}` : "Ainda não iniciado"}
        </span>
      </header>

      <div className={styles.body}>
        <div className={styles.icon} aria-hidden="true">
          Q
        </div>

        <div className={styles.copy}>
          {lastActivity ? (
            <>
              <strong>{lastActivity.disciplineName}</strong>
              <p>Continue de onde parou com questões desta matéria que você ainda não resolveu.</p>
            </>
          ) : (
            <>
              <strong>Escolha uma disciplina para começar</strong>
              <p>
                Quando você iniciar seus estudos, o Sou Bizurado vai manter aqui
                seu último contexto para você continuar sem perder o ritmo.
              </p>
            </>
          )}
        </div>

        <Link
          href={
            lastActivity
              ? buildQuestionExplorerHref({ disciplineId: lastActivity.disciplineId, situation: "nao-resolvidas" })
              : "/app/questoes"
          }
          className={styles.action}
        >
          {lastActivity ? "Continuar" : "Explorar questões"}
        </Link>
      </div>
    </article>
  );
}
