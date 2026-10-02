"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import type { PublicQuestionDto } from "@/modules/question-bank/application/dto/public-question";
import { formatClock } from "@/modules/study/domain/simulation";
import {
  finishSimulationAction,
  saveSimulationAnswerAction,
} from "@/modules/study/presentation/actions/simulation-actions";
import { hasVisibleContent } from "@/shared/ui/inline-markdown";
import { RichText } from "@/shared/ui/rich-text";

import { QuestionMedia } from "../../questoes/_components/question-media";
import styles from "./exam.module.css";

type Answer =
  | Readonly<{ type: "MULTIPLE_CHOICE"; alternativeId: string }>
  | Readonly<{ type: "TRUE_FALSE"; value: boolean }>
  | null;

type ExamQuestion = Readonly<{
  question: PublicQuestionDto;
  position: number;
  selected: Answer;
  /** Subject of the notice this question belongs to (official exams). */
  section: string | null;
}>;

type SimulationExamProps = Readonly<{
  simulationId: string;
  title: string;
  /** Seconds left when the page was rendered; null without a time limit. */
  remainingSeconds: number | null;
  official: boolean;
  questions: readonly ExamQuestion[];
}>;

const same = (left: Answer, right: Answer) => JSON.stringify(left) === JSON.stringify(right);

/**
 * The running exam, built like a real one: it covers the whole screen, shows one
 * question at a time with a clock on top, a numbered map of the exam on the side
 * (by subject), "mark for review" and a confirmation before finishing. Answers
 * are saved as they are chosen; there is no feedback until the end.
 */
export function SimulationExam({ simulationId, title, remainingSeconds, official, questions }: SimulationExamProps) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>(() =>
    Object.fromEntries(questions.map((item) => [item.question.id, item.selected])),
  );
  const [marked, setMarked] = useState<ReadonlySet<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(remainingSeconds);
  const [finishing, startFinishing] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const stage = useRef<HTMLElement | null>(null);

  const total = questions.length;
  const current = questions[index]!;
  const chosen = answers[current.question.id] ?? null;
  const answeredCount = Object.values(answers).filter(Boolean).length;
  const markedKey = `sb-simulado-${simulationId}-marcadas`;

  // Marked questions survive a reload (this browser only).
  useEffect(() => {
    // Deferred so the first render is the same as the server's.
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(window.localStorage.getItem(markedKey) ?? "[]") as string[];

        setMarked(new Set(saved.filter((id) => questions.some((item) => item.question.id === id))));
      } catch {
        // No storage: marks live only while the exam is open.
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [markedKey, questions]);

  const finish = useCallback(() => {
    startFinishing(async () => {
      const result = await finishSimulationAction(simulationId);

      if (!result.ok) {
        setError(result.message);
        setConfirming(false);
        return;
      }

      try {
        window.localStorage.removeItem(markedKey);
      } catch {
        // Nothing to clean.
      }

      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => undefined);
      }

      router.refresh();
    });
  }, [markedKey, router, simulationId]);

  // The clock: at zero the exam is graded with what was answered.
  useEffect(() => {
    if (remainingSeconds === null) {
      return;
    }

    const endsAt = Date.now() + remainingSeconds * 1000;
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));

      setSecondsLeft(left);

      if (left === 0) {
        window.clearInterval(timer);
        finish();
      }
    }, 500);

    return () => window.clearInterval(timer);
  }, [remainingSeconds, finish]);

  // Full screen state, page scroll lock and a warning before leaving by accident.
  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    const leave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const previous = document.body.style.overflow;

    sync();
    document.body.style.overflow = "hidden";
    document.addEventListener("fullscreenchange", sync);
    window.addEventListener("beforeunload", leave);

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("fullscreenchange", sync);
      window.removeEventListener("beforeunload", leave);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      setError("Seu navegador não permitiu a tela cheia.");
    }
  }, []);

  const go = useCallback(
    (next: number) => {
      setIndex(Math.min(total - 1, Math.max(0, next)));
      setMapOpen(false);
      stage.current?.scrollTo({ top: 0 });
    },
    [total],
  );

  async function choose(answer: Answer) {
    const questionId = current.question.id;
    const previous = answers[questionId] ?? null;
    const next = same(previous, answer) ? null : answer; // clicking the chosen option clears it

    setAnswers((state) => ({ ...state, [questionId]: next }));
    setSaving(true);
    setError(null);

    const result = await saveSimulationAnswerAction(simulationId, questionId, next);

    setSaving(false);

    if (!result.ok) {
      setAnswers((state) => ({ ...state, [questionId]: previous }));
      setError(result.message);
    }
  }

  function toggleMark() {
    setMarked((state) => {
      const next = new Set(state);

      if (next.has(current.question.id)) {
        next.delete(current.question.id);
      } else {
        next.add(current.question.id);
      }

      try {
        window.localStorage.setItem(markedKey, JSON.stringify([...next]));
      } catch {
        // No storage.
      }

      return next;
    });
  }

  // Keyboard: arrows move, A-E answer, M marks.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (confirming || finishing || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;

      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "arrowright") go(index + 1);
      else if (key === "arrowleft") go(index - 1);
      else if (key === "m") toggleMark();
      else if (current.question.type === "MULTIPLE_CHOICE") {
        const alternative = current.question.alternatives.find((candidate) => candidate.label.toLowerCase() === key);

        if (alternative) void choose({ type: "MULTIPLE_CHOICE", alternativeId: alternative.id });
      } else if (key === "c" || key === "e") {
        void choose({ type: "TRUE_FALSE", value: key === "c" });
      }
    }

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
    // choose/toggleMark close over the current question; the handler is rebuilt when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, confirming, finishing, answers, current.question.id]);

  // The map of the exam, grouped by subject.
  const groups = useMemo(() => {
    const result: { name: string | null; items: ExamQuestion[] }[] = [];

    for (const item of questions) {
      const last = result[result.length - 1];

      if (last && last.name === item.section) {
        last.items.push(item);
      } else {
        result.push({ name: item.section, items: [item] });
      }
    }

    return result;
  }, [questions]);

  const supports = current.question.supportContents.filter((support) => hasVisibleContent(support.content, current.question.textImages));
  const lowTime = secondsLeft !== null && secondsLeft <= 600;
  const blank = total - answeredCount;
  const markedCount = [...marked].filter((id) => questions.some((item) => item.question.id === id)).length;

  return (
    <div className={styles.overlay} role="region" aria-label={`Simulado: ${title}`}>
      <header className={styles.bar}>
        <div className={styles.titleBox}>
          <span>{official ? "Simulado oficial" : "Simulado"}</span>
          <strong>{title.replace(/^Simulado oficial — /, "")}</strong>
        </div>

        {secondsLeft !== null ? (
          <div className={`${styles.clock} ${secondsLeft <= 300 ? styles.clockCritical : lowTime ? styles.clockLow : ""}`} aria-label="Tempo restante" role="timer">
            <span>Tempo restante</span>
            <strong>{formatClock(secondsLeft)}</strong>
          </div>
        ) : (
          <div className={styles.clock}>
            <span>Sem limite de tempo</span>
          </div>
        )}

        <div className={styles.actions}>
          <span className={styles.progressText}>
            {answeredCount}/{total} respondidas
          </span>
          <button type="button" className={styles.ghost} onClick={() => void toggleFullscreen()}>
            {fullscreen ? "Sair da tela cheia" : "Tela cheia"}
          </button>
          <button type="button" className={styles.mapButton} onClick={() => setMapOpen((open) => !open)} aria-expanded={mapOpen}>
            Questões
          </button>
          <button type="button" className={styles.finish} onClick={() => setConfirming(true)} disabled={finishing}>
            {finishing ? "Corrigindo…" : "Finalizar"}
          </button>
        </div>
      </header>

      {official && !fullscreen ? (
        <div className={styles.banner} role="status">
          Para simular a prova de verdade, use a tela cheia.{" "}
          <button type="button" onClick={() => void toggleFullscreen()}>
            Entrar em tela cheia
          </button>
        </div>
      ) : null}

      <div className={styles.body}>
        <main className={styles.stage} ref={stage}>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          <article className={styles.question} aria-labelledby="exam-question-title">
            <header className={styles.questionHead}>
              <h2 id="exam-question-title">
                Questão {index + 1} <small>de {total}</small>
              </h2>
              <span>{current.section ?? current.question.classification.discipline.name}</span>
              {saving ? <em>salvando…</em> : null}
            </header>

            {supports.length > 0 ? (
              <div className={styles.support}>
                {supports.map((support) => (
                  <p key={support.id}>
                    <RichText text={support.content} images={current.question.textImages} />
                  </p>
                ))}
              </div>
            ) : null}

            <div className={styles.statement}>
              <RichText text={current.question.statement} images={current.question.textImages} />
            </div>

            <QuestionMedia media={current.question.media} fallbackAlt={`Imagem da questão ${current.question.code}`} />

            <div className={styles.options} role="group" aria-label="Alternativas">
              {current.question.type === "MULTIPLE_CHOICE"
                ? current.question.alternatives.map((alternative) => {
                    const selected = chosen?.type === "MULTIPLE_CHOICE" && chosen.alternativeId === alternative.id;

                    return (
                      <button
                        key={alternative.id}
                        type="button"
                        className={selected ? styles.optionSelected : styles.option}
                        aria-pressed={selected}
                        disabled={finishing}
                        onClick={() => void choose({ type: "MULTIPLE_CHOICE", alternativeId: alternative.id })}
                      >
                        <span className={styles.optionLabel}>{alternative.label}</span>
                        <span className={styles.optionText}>
                          <RichText text={alternative.content} images={current.question.textImages} />
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
                        onClick={() => void choose({ type: "TRUE_FALSE", value })}
                      >
                        <span className={styles.optionLabel}>{value ? "C" : "E"}</span>
                        <span className={styles.optionText}>{value ? "Certo" : "Errado"}</span>
                      </button>
                    );
                  })}
            </div>

            <footer className={styles.footer}>
              <button type="button" className={styles.secondary} onClick={() => go(index - 1)} disabled={index === 0}>
                ← Anterior
              </button>
              <button type="button" className={marked.has(current.question.id) ? styles.markedButton : styles.secondary} onClick={toggleMark} aria-pressed={marked.has(current.question.id)}>
                {marked.has(current.question.id) ? "★ Marcada para revisão" : "☆ Marcar para revisão"}
              </button>
              {index < total - 1 ? (
                <button type="button" className={styles.primary} onClick={() => go(index + 1)}>
                  Próxima →
                </button>
              ) : (
                <button type="button" className={styles.primary} onClick={() => setConfirming(true)}>
                  Finalizar prova
                </button>
              )}
            </footer>
            <p className={styles.shortcuts}>Atalhos: ← → trocam de questão · A–E respondem · M marca para revisão.</p>
          </article>
        </main>

        <aside className={`${styles.panel} ${mapOpen ? styles.panelOpen : ""}`} aria-label="Mapa da prova">
          <div className={styles.legend}>
            <span>
              <i className={styles.swAnswered} /> Respondida
            </span>
            <span>
              <i className={styles.swMarked} /> Marcada
            </span>
            <span>
              <i className={styles.swBlank} /> Em branco
            </span>
          </div>

          {groups.map((group, groupIndex) => (
            <section key={`${group.name}-${groupIndex}`} className={styles.group}>
              {group.name ? <h3>{group.name}</h3> : null}
              <div className={styles.grid}>
                {group.items.map((item) => {
                  const isCurrent = item.position === index;
                  const state = marked.has(item.question.id) ? styles.cellMarked : answers[item.question.id] ? styles.cellAnswered : styles.cellBlank;

                  return (
                    <button key={item.question.id} type="button" className={`${state} ${isCurrent ? styles.cellCurrent : ""}`} onClick={() => go(item.position)} aria-label={`Questão ${item.position + 1}`} aria-current={isCurrent ? "true" : undefined}>
                      {item.position + 1}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </aside>
      </div>

      {confirming ? (
        <div className={styles.dialogBackdrop} role="dialog" aria-modal="true" aria-labelledby="finish-title">
          <div className={styles.dialog}>
            <h2 id="finish-title">Finalizar a prova?</h2>
            <dl>
              <div>
                <dt>Respondidas</dt>
                <dd>{answeredCount}</dd>
              </div>
              <div>
                <dt>Em branco</dt>
                <dd className={blank > 0 ? styles.warn : undefined}>{blank}</dd>
              </div>
              <div>
                <dt>Marcadas para revisão</dt>
                <dd>{markedCount}</dd>
              </div>
            </dl>
            <p>Depois de finalizar não dá para alterar as respostas.</p>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.secondary} onClick={() => setConfirming(false)} disabled={finishing}>
                Voltar à prova
              </button>
              <button type="button" className={styles.finish} onClick={finish} disabled={finishing}>
                {finishing ? "Corrigindo…" : "Finalizar e ver o resultado"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
