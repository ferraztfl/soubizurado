"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import type { PublicQuestionDto } from "@/modules/question-bank/application/dto/public-question";
import { formatClock } from "@/modules/study/domain/simulation";
import {
  finishSimulationAction,
  saveSimulationAnswerAction,
} from "@/modules/study/presentation/actions/simulation-actions";
import { hasVisibleContent } from "@/shared/ui/inline-markdown";
import { RichText } from "@/shared/ui/rich-text";

import { QuestionMedia } from "../../questoes/_components/question-media";
import styles from "../simulados.module.css";

type Answer =
  | Readonly<{ type: "MULTIPLE_CHOICE"; alternativeId: string }>
  | Readonly<{ type: "TRUE_FALSE"; value: boolean }>
  | null;

type ExamQuestion = Readonly<{
  question: PublicQuestionDto;
  position: number;
  selected: Answer;
}>;

type SimulationExamProps = Readonly<{
  simulationId: string;
  title: string;
  /** Seconds left when the page was rendered; null without a time limit. */
  remainingSeconds: number | null;
  questions: readonly ExamQuestion[];
}>;

const same = (left: Answer, right: Answer) => JSON.stringify(left) === JSON.stringify(right);

/** The running exam: no feedback until the end, answers saved as they are chosen. */
export function SimulationExam({ simulationId, title, remainingSeconds, questions }: SimulationExamProps) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, Answer>>(() =>
    Object.fromEntries(questions.map((item) => [item.question.id, item.selected])),
  );
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(remainingSeconds);
  const [finishing, startFinishing] = useTransition();

  const answeredCount = Object.values(answers).filter(Boolean).length;

  function finish() {
    startFinishing(async () => {
      const result = await finishSimulationAction(simulationId);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      router.refresh();
    });
  }

  // Countdown; at zero the exam is graded with what was answered.
  useEffect(() => {
    if (remainingSeconds === null) {
      return;
    }

    const endsAt = Date.now() + remainingSeconds * 1000;
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setSecondsLeft(left);

      if (left === 0) {
        window.clearInterval(timer);
        finish();
      }
    }, 1000);

    return () => window.clearInterval(timer);
    // finish() only reads stable values; the timer is set once per render of the exam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds]);

  async function choose(questionId: string, answer: Answer) {
    const previous = answers[questionId] ?? null;
    const next = same(previous, answer) ? null : answer; // clicking the chosen option clears it

    setAnswers((current) => ({ ...current, [questionId]: next }));
    setSaving((current) => ({ ...current, [questionId]: true }));
    setError(null);

    const result = await saveSimulationAnswerAction(simulationId, questionId, next);

    setSaving((current) => ({ ...current, [questionId]: false }));

    if (!result.ok) {
      setAnswers((current) => ({ ...current, [questionId]: previous }));
      setError(result.message);
    }
  }

  function confirmFinish() {
    const blank = questions.length - answeredCount;
    const message =
      blank > 0
        ? `Você deixou ${blank} ${blank === 1 ? "questão" : "questões"} em branco. Finalizar mesmo assim?`
        : "Finalizar o simulado e ver o resultado?";

    if (window.confirm(message)) {
      finish();
    }
  }

  return (
    <>
      <header className={styles.examBar}>
        <div className={styles.examTitle}>
          <span>Simulado</span>
          <strong>{title}</strong>
        </div>
        <div className={styles.examStatus}>
          <span>
            {answeredCount}/{questions.length} respondidas
          </span>
          {secondsLeft !== null ? (
            <span className={secondsLeft <= 300 ? styles.clockLow : styles.clock} aria-live="off">
              ⏱ {formatClock(secondsLeft)}
            </span>
          ) : null}
          <button type="button" className={styles.primary} onClick={confirmFinish} disabled={finishing}>
            {finishing ? "Corrigindo…" : "Finalizar"}
          </button>
        </div>
      </header>

      <nav className={styles.navigator} aria-label="Ir para a questão">
        {questions.map((item) => (
          <a
            key={item.question.id}
            href={`#questao-${item.position + 1}`}
            className={answers[item.question.id] ? styles.navAnswered : styles.navItem}
          >
            {item.position + 1}
          </a>
        ))}
      </nav>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <ol className={styles.examList}>
        {questions.map((item) => {
          const { question } = item;
          const chosen = answers[question.id] ?? null;
          const supports = question.supportContents.filter((support) =>
            hasVisibleContent(support.content, question.textImages),
          );

          return (
            <li key={question.id} id={`questao-${item.position + 1}`} className={styles.examQuestion}>
              <header className={styles.examQuestionHead}>
                <span className={styles.examNumber}>{item.position + 1}</span>
                <span>
                  {question.code} · {question.classification.discipline.name}
                  {question.examination ? ` · ${question.examination.title}` : ""}
                </span>
                {saving[question.id] ? <small>salvando…</small> : null}
              </header>

              {supports.length > 0 ? (
                <div className={styles.examSupport}>
                  {supports.map((support) => (
                    <p key={support.id}>
                      <RichText text={support.content} images={question.textImages} />
                    </p>
                  ))}
                </div>
              ) : null}

              <div className={styles.examStatement}>
                <RichText text={question.statement} images={question.textImages} />
              </div>

              <QuestionMedia media={question.media} fallbackAlt={`Imagem da questão ${question.code}`} />

              <div className={styles.examOptions} role="group" aria-label="Alternativas">
                {question.type === "MULTIPLE_CHOICE"
                  ? question.alternatives.map((alternative) => {
                      const selected =
                        chosen?.type === "MULTIPLE_CHOICE" && chosen.alternativeId === alternative.id;

                      return (
                        <button
                          key={alternative.id}
                          type="button"
                          className={selected ? styles.optionSelected : styles.option}
                          aria-pressed={selected}
                          disabled={finishing}
                          onClick={() => choose(question.id, { type: "MULTIPLE_CHOICE", alternativeId: alternative.id })}
                        >
                          <span className={styles.optionLabel}>{alternative.label}</span>
                          <span className={styles.optionText}>
                            <RichText text={alternative.content} images={question.textImages} />
                            <QuestionMedia
                              media={alternative.media}
                              variant="alternative"
                              allowDocumentLinks={false}
                              fallbackAlt={`Imagem da alternativa ${alternative.label}`}
                            />
                          </span>
                        </button>
                      );
                    })
                  : [true, false].map((value) => {
                      const selected = chosen?.type === "TRUE_FALSE" && chosen.value === value;

                      return (
                        <button
                          key={String(value)}
                          type="button"
                          className={selected ? styles.optionSelected : styles.option}
                          aria-pressed={selected}
                          disabled={finishing}
                          onClick={() => choose(question.id, { type: "TRUE_FALSE", value })}
                        >
                          <span className={styles.optionLabel}>{value ? "C" : "E"}</span>
                          <span className={styles.optionText}>{value ? "Certo" : "Errado"}</span>
                        </button>
                      );
                    })}
              </div>
            </li>
          );
        })}
      </ol>

      <div className={styles.examFooter}>
        <button type="button" className={styles.primary} onClick={confirmFinish} disabled={finishing}>
          {finishing ? "Corrigindo…" : `Finalizar (${answeredCount}/${questions.length})`}
        </button>
      </div>
    </>
  );
}
