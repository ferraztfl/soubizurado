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

import styles from "./question-answer-panel.module.css";

type QuestionAnswerPanelProps = Readonly<{
  question: PublicQuestionDto;
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
}: QuestionAnswerPanelProps) {
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

  function resetAttempt(): void {
    setSelection(null);
    setResult(null);
    setLocalError(null);
    startedAt.current = null;
  }

  return (
    <div className={styles.panel}>
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

              return (
                <button
                  key={alternative.id}
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
                      type: "MULTIPLE_CHOICE",
                      alternativeId:
                        alternative.id,
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
                    {alternative.content}
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
