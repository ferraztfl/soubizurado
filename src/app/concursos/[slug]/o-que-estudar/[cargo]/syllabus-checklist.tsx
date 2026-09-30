"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { studiedPercent } from "@/modules/contests/domain/syllabus";

import { toggleSyllabusTopicAction } from "./actions";
import styles from "./syllabus-page.module.css";

type Topic = Readonly<{ id: string; code: string | null; text: string }>;
type Subject = Readonly<{
  id: string;
  name: string;
  questionCount: number | null;
  block: string | null;
  questionsHref: string | null;
  topics: readonly Topic[];
}>;

type SyllabusChecklistProps = Readonly<{
  subjects: readonly Subject[];
  initialStudied: readonly string[];
  signedIn: boolean;
  loginHref: string;
}>;

/** Subjects with their topics; a signed-in student ticks what was already studied. */
export function SyllabusChecklist({ subjects, initialStudied, signedIn, loginHref }: SyllabusChecklistProps) {
  const [studied, setStudied] = useState<ReadonlySet<string>>(() => new Set(initialStudied));
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const total = subjects.reduce((sum, subject) => sum + subject.topics.length, 0);

  function toggle(topicId: string, value: boolean) {
    setError(null);
    setStudied((current) => withTopic(current, topicId, value));
    startTransition(async () => {
      const result = await toggleSyllabusTopicAction(topicId, value).catch(() => ({ ok: false as const, reason: "INVALID" as const }));
      if (!result.ok) {
        setStudied((current) => withTopic(current, topicId, !value));
        setError(result.reason === "SIGN_IN" ? "Sua sessão expirou. Entre de novo para salvar." : "Não foi possível salvar. Tente de novo.");
      }
    });
  }

  return (
    <div className={styles.checklist}>
      <div className={styles.progress} aria-live="polite">
        {signedIn ? (
          <>
            <div className={styles.progressHead}>
              <strong>Seu progresso</strong>
              <span>
                {studied.size} de {total} assuntos · {studiedPercent(studied.size, total)}%
              </span>
            </div>
            <div className={styles.track} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={studiedPercent(studied.size, total)}>
              <div className={styles.fill} style={{ width: `${studiedPercent(studied.size, total)}%` }} />
            </div>
          </>
        ) : (
          <p>
            <Link href={loginHref}>Entre ou crie sua conta grátis</Link> para marcar os assuntos que você já estudou e acompanhar seu
            progresso no edital.
          </p>
        )}
        {error ? <p className={styles.error}>{error}</p> : null}
      </div>

      {subjects.map((subject) => {
        const done = subject.topics.filter((topic) => studied.has(topic.id)).length;
        return (
          <details key={subject.id} className={styles.subject} open>
            <summary>
              <span className={styles.subjectName}>
                {subject.name}
                {subject.block ? <small>{subject.block}</small> : null}
              </span>
              <span className={styles.subjectMeta}>
                {subject.questionCount === null ? null : <b>{subject.questionCount} questões</b>}
                {signedIn ? (
                  <em>
                    {done}/{subject.topics.length}
                  </em>
                ) : null}
              </span>
            </summary>
            <ol className={styles.topics}>
              {subject.topics.map((topic) => (
                <li key={topic.id} className={studied.has(topic.id) ? styles.topicDone : undefined}>
                  <label>
                    <input
                      type="checkbox"
                      checked={studied.has(topic.id)}
                      disabled={!signedIn}
                      onChange={(event) => toggle(topic.id, event.currentTarget.checked)}
                    />
                    {topic.code ? <span className={styles.code}>{topic.code}</span> : null}
                    <span>{topic.text}</span>
                  </label>
                </li>
              ))}
            </ol>
            {subject.questionsHref ? (
              <Link href={subject.questionsHref} className={styles.practice}>
                Resolver questões de {subject.name} →
              </Link>
            ) : null}
          </details>
        );
      })}
    </div>
  );
}

function withTopic(current: ReadonlySet<string>, topicId: string, value: boolean): ReadonlySet<string> {
  const next = new Set(current);
  if (value) next.add(topicId);
  else next.delete(topicId);
  return next;
}
