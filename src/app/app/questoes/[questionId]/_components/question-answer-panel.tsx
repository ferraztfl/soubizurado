"use client";

import {
  useRef,
  useState,
  useTransition,
} from "react";

import type {
  PublicQuestionDto,
} from "@/modules/question-bank/application/dto/public-question";
import type {
  StudyAnswerActionResult,
} from "@/modules/study/presentation/actions/study-answer-actions";
import {
  submitStudyAnswerAction,
} from "@/modules/study/presentation/actions/study-answer-actions";

import { RichText } from "@/shared/ui/rich-text";

import { QuestionMedia } from "../../_components/question-media";

import styles from "./question-answer-panel.module.css";

type QuestionAnswerPanelProps = Readonly<{
  question: PublicQuestionDto;
  /** Tighter spacing inside the question list. */
  compact?: boolean;
}>;

type SelectedAnswer =
  | Readonly<{
      type: "MULTIPLE_CHOICE";
      alternativeId: string;
    }>
  | Readonly<{
      type: "TRUE_FALSE";
      value: boolean;
    }>
  | null;

function isSelected(
  selection: SelectedAnswer,
  alternativeId: string,
): boolean {
  return (
    selection?.type === "MULTIPLE_CHOICE" &&
    selection.alternativeId === alternativeId
  );
}

function isCorrectAlternative(
  result: StudyAnswerActionResult | null,
  alternativeId: string,
): boolean {
  return (
    result?.ok === true &&
    result.data.correctAnswer.type ===
      "MULTIPLE_CHOICE" &&
    result.data.correctAnswer.alternativeId ===
      alternativeId
  );
}

function isWrongSelectedAlternative(
  selection: SelectedAnswer,
  result: StudyAnswerActionResult | null,
  alternativeId: string,
): boolean {
  return (
    result?.ok === true &&
    result.data.isCorrect === false &&
    isSelected(selection, alternativeId)
  );
}

function trueFalseLabel(
  value: boolean,
): string {
  return value ? "Certo" : "Errado";
}

export function QuestionAnswerPanel({
  question,
  compact = false,
}: QuestionAnswerPanelProps) {
  // Alternatives the student ruled out ("riscar"); purely visual.
  const [eliminated, setEliminated] =
    useState<ReadonlySet<string>>(() => new Set());
  const [selection, setSelection] =
    useState<SelectedAnswer>(null);
  const [result, setResult] =
    useState<StudyAnswerActionResult | null>(
      null,
    );
  const [localError, setLocalError] =
    useState<string | null>(null);
  const [isPending, startTransition] =
    useTransition();
  const startedAt = useRef<number | null>(
    null,
  );

  const submitted = result?.ok === true;

  function submitAnswer(): void {
    if (!selection) {
      setLocalError(
        "Selecione uma resposta antes de corrigir.",
      );
      return;
    }

    setLocalError(null);

    const responseTimeMs = Math.min(
      Math.max(
        startedAt.current === null
          ? 0
          : Date.now() - startedAt.current,
        0,
      ),
      86_400_000,
    );

    startTransition(async () => {
      const outcome =
        await submitStudyAnswerAction({
          questionId: question.id,
          answer: selection,
          responseTimeMs,
        });

      setResult(outcome);
    });
  }

  function toggleEliminated(alternativeId: string): void {
    setEliminated((current) => {
      const next = new Set(current);

      if (next.has(alternativeId)) {
        next.delete(alternativeId);
      } else {
        next.add(alternativeId);

        if (
          selection?.type === "MULTIPLE_CHOICE" &&
          selection.alternativeId === alternativeId
        ) {
          setSelection(null);
        }
      }

      return next;
    });
  }

  function resetAttempt(): void {
    setEliminated(new Set());
    setSelection(null);
    setResult(null);
    setLocalError(null);
    startedAt.current = null;
  }

  return (
    <div className={compact ? `${styles.panel} ${styles.compact}` : styles.panel}>
      {question.type ===
      "MULTIPLE_CHOICE" ? (
        <div
          className={styles.options}
          aria-label="Alternativas"
        >
          {question.alternatives.map(
            (alternative) => {
              const selected = isSelected(
                selection,
                alternative.id,
              );
              const correct =
                isCorrectAlternative(
                  result,
                  alternative.id,
                );
              const wrong =
                isWrongSelectedAlternative(
                  selection,
                  result,
                  alternative.id,
                );

              const struck =
                eliminated.has(alternative.id) &&
                !correct;

              return (
                <div
                  key={alternative.id}
                  className={styles.optionRow}
                >
                <button
                  type="button"
                  className={[
                    styles.eliminate,
                    struck ? styles.eliminateActive : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-pressed={struck}
                  aria-label={
                    struck
                      ? `Restaurar alternativa ${alternative.label}`
                      : `Riscar alternativa ${alternative.label}`
                  }
                  title={
                    struck
                      ? "Restaurar alternativa"
                      : "Riscar alternativa"
                  }
                  disabled={isPending || submitted}
                  onClick={() =>
                    toggleEliminated(alternative.id)
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    aria-hidden="true"
                  >
                    <circle cx="6" cy="6" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
                    <circle cx="6" cy="18" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
                    <path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>

                <button
                  type="button"
                  className={[
                    styles.option,
                    selected
                      ? styles.selected
                      : "",
                    correct
                      ? styles.correct
                      : "",
                    wrong ? styles.wrong : "",
                    struck ? styles.struck : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-pressed={selected}
                  disabled={
                    isPending || submitted
                  }
                  onClick={() => {
                    startedAt.current ??= Date.now();
                    setSelection({
                      type: "MULTIPLE_CHOICE",
                      alternativeId:
                        alternative.id,
                    });
                    setEliminated((current) => {
                      const next = new Set(current);
                      next.delete(alternative.id);
                      return next;
                    });
                    setLocalError(null);
                  }}
                >
                  <span
                    className={styles.label}
                    aria-hidden="true"
                  >
                    {alternative.label}
                  </span>

                  <span
                    className={styles.optionText}
                  >
                    <span>
                      <RichText
                        text={
                          alternative.content
                        }
                      />
                    </span>

                    <QuestionMedia
                      media={alternative.media}
                      variant="alternative"
                      allowDocumentLinks={false}
                      fallbackAlt={`Imagem da alternativa ${alternative.label}`}
                    />
                  </span>

                  {correct ? (
                    <span
                      className={styles.feedbackTag}
                    >
                      Correta
                    </span>
                  ) : null}

                  {wrong ? (
                    <span
                      className={styles.feedbackTag + " " + styles.wrongTag}
                    >
                      Sua resposta
                    </span>
                  ) : null}
                </button>
                </div>
              );
            },
          )}
        </div>
      ) : (
        <div
          className={styles.trueFalse}
          aria-label="Opções de julgamento"
        >
          {[true, false].map((value) => {
            const selected =
              selection?.type ===
                "TRUE_FALSE" &&
              selection.value === value;
            const correct =
              result?.ok === true &&
              result.data.correctAnswer
                .type === "TRUE_FALSE" &&
              result.data.correctAnswer
                .value === value;
            const wrong =
              result?.ok === true &&
              !result.data.isCorrect &&
              selected;

            return (
              <button
                key={String(value)}
                type="button"
                className={[
                  styles.option,
                  selected
                    ? styles.selected
                    : "",
                  correct
                    ? styles.correct
                    : "",
                  wrong ? styles.wrong : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={selected}
                disabled={
                  isPending || submitted
                }
                onClick={() => {
                  startedAt.current ??= Date.now();
                  setSelection({
                    type: "TRUE_FALSE",
                    value,
                  });
                  setLocalError(null);
                }}
              >
                <span
                  className={styles.label}
                  aria-hidden="true"
                >
                  {value ? "C" : "E"}
                </span>

                <span
                  className={styles.optionText}
                >
                  {trueFalseLabel(value)}
                </span>

                {correct ? (
                  <span
                    className={styles.feedbackTag}
                  >
                    Correta
                  </span>
                ) : null}

                {wrong ? (
                  <span
                    className={styles.feedbackTag + " " + styles.wrongTag}
                  >
                    Sua resposta
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {localError ? (
        <p
          className={styles.error}
          role="alert"
        >
          {localError}
        </p>
      ) : null}

      {result?.ok === false ? (
        <p
          className={styles.error}
          role="alert"
        >
          {result.message}
        </p>
      ) : null}

      {result?.ok === true ? (
        <section
          className={
            result.data.isCorrect
              ? styles.correctFeedback
              : styles.incorrectFeedback
          }
          aria-live="polite"
        >
          <span className={styles.feedbackEyebrow}>
            {result.data.isCorrect
              ? "Resposta correta"
              : "Resposta incorreta"}
          </span>

          <strong>
            {result.data.isCorrect
              ? "Muito bem. A tentativa foi registrada."
              : "A tentativa foi registrada. Veja o gabarito e revise o raciocínio."}
          </strong>

          {result.data.explanation ? (
            <p>{result.data.explanation}</p>
          ) : (
            <p>
              Esta questão ainda não possui uma
              explicação cadastrada.
            </p>
          )}
        </section>
      ) : null}

      <div className={styles.actions}>
        {!submitted ? (
          <button
            type="button"
            className={styles.submit}
            disabled={
              isPending || selection === null
            }
            onClick={submitAnswer}
          >
            {isPending
              ? "Corrigindo..."
              : "Corrigir resposta"}
          </button>
        ) : (
          <button
            type="button"
            className={styles.retry}
            onClick={resetAttempt}
          >
            Responder novamente
          </button>
        )}

        <span className={styles.hint}>
          O gabarito só é revelado após o
          envio da resposta.
        </span>
      </div>
    </div>
  );
}
