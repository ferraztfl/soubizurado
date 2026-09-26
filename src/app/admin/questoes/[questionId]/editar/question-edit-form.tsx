"use client";

import { useActionState, useState } from "react";

import { SubmitButton } from "@/app/admin/_components/submit-button";

import {
  saveQuestionContentAction,
  type SaveQuestionContentState,
} from "./actions";
import styles from "./editar.module.css";

type FormAlternative = Readonly<{
  id: string;
  label: string;
  content: string;
  isCorrect: boolean;
  images: readonly Readonly<{ id: string; url: string; alt: string }>[];
}>;

type QuestionEditFormProps = Readonly<{
  questionId: string;
  updatedAt: string;
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE";
  isPublished: boolean;
  statement: string;
  correctTrueFalse: boolean | null;
  alternatives: readonly FormAlternative[];
}>;

const initialState: SaveQuestionContentState = { error: null };

/** Controlled so the typed text survives a rejected save. */
export function QuestionEditForm(props: QuestionEditFormProps) {
  const [state, formAction] = useActionState(saveQuestionContentAction, initialState);

  const initialCorrect = props.alternatives.find((alternative) => alternative.isCorrect)?.id ?? "";

  const [statement, setStatement] = useState(props.statement);
  const [contents, setContents] = useState<Record<string, string>>(() =>
    Object.fromEntries(props.alternatives.map((alternative) => [alternative.id, alternative.content])),
  );
  const [correctId, setCorrectId] = useState(initialCorrect);
  const [trueFalse, setTrueFalse] = useState(
    props.correctTrueFalse === null ? "" : String(props.correctTrueFalse),
  );
  const [reason, setReason] = useState("");
  const [confirmKey, setConfirmKey] = useState(false);

  const answerKeyChanged =
    props.type === "MULTIPLE_CHOICE"
      ? correctId !== initialCorrect
      : trueFalse !== (props.correctTrueFalse === null ? "" : String(props.correctTrueFalse));

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="questionId" value={props.questionId} />
      <input type="hidden" name="updatedAt" value={props.updatedAt} />

      {state.error ? (
        <div className={styles.noticeError} role="alert">
          {state.error}
        </div>
      ) : null}

      <section className={styles.card}>
        <div>
          <h2 className={styles.cardTitle}>Enunciado</h2>
          <p className={styles.hint}>
            Aceita **negrito**, *itálico* e quebras de linha. Imagens do enunciado são mantidas.
          </p>
        </div>

        <label className={styles.srOnly} htmlFor="statement">
          Enunciado
        </label>
        <textarea
          id="statement"
          name="statement"
          className={styles.textarea}
          rows={10}
          value={statement}
          onChange={(event) => setStatement(event.target.value)}
          required
        />
      </section>

      {props.type === "MULTIPLE_CHOICE" ? (
        <fieldset className={styles.card}>
          <legend className={styles.cardTitle}>Alternativas e gabarito</legend>
          <p className={styles.hint}>
            Marque a alternativa correta. A ordem e as letras não mudam para preservar as respostas dos
            alunos.
          </p>

          <ol className={styles.alternatives}>
            {props.alternatives.map((alternative) => (
              <li
                key={alternative.id}
                className={`${styles.alternative} ${
                  correctId === alternative.id ? styles.alternativeCorrect : ""
                }`}
              >
                <label className={styles.correctChoice}>
                  <input
                    type="radio"
                    name="correctAlternativeId"
                    value={alternative.id}
                    checked={correctId === alternative.id}
                    onChange={() => setCorrectId(alternative.id)}
                  />
                  <span className={styles.letter}>{alternative.label}</span>
                  <span className={styles.srOnly}>Marcar {alternative.label} como correta</span>
                </label>

                <div className={styles.alternativeBody}>
                  <label className={styles.srOnly} htmlFor={`alternative-${alternative.id}`}>
                    Texto da alternativa {alternative.label}
                  </label>
                  <textarea
                    id={`alternative-${alternative.id}`}
                    name={`alternative:${alternative.id}`}
                    className={styles.textarea}
                    rows={2}
                    value={contents[alternative.id] ?? ""}
                    placeholder={alternative.images.length > 0 ? "Sem texto (alternativa em imagem)" : ""}
                    onChange={(event) =>
                      setContents((current) => ({ ...current, [alternative.id]: event.target.value }))
                    }
                  />

                  {alternative.images.length > 0 ? (
                    <div className={styles.images}>
                      {alternative.images.map((image) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={image.id} src={image.url} alt={image.alt} loading="lazy" />
                      ))}
                    </div>
                  ) : null}

                  {correctId === alternative.id ? <span className={styles.correctTag}>Gabarito</span> : null}
                </div>
              </li>
            ))}
          </ol>
        </fieldset>
      ) : (
        <fieldset className={styles.card}>
          <legend className={styles.cardTitle}>Gabarito</legend>
          <div className={styles.trueFalse}>
            {[
              { value: "true", label: "Certo" },
              { value: "false", label: "Errado" },
            ].map((option) => (
              <label key={option.value} className={styles.trueFalseOption}>
                <input
                  type="radio"
                  name="correctTrueFalse"
                  value={option.value}
                  checked={trueFalse === option.value}
                  onChange={() => setTrueFalse(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <section className={styles.card}>
        <label className={styles.cardTitle} htmlFor="reason">
          Motivo da alteração
        </label>
        <input
          id="reason"
          name="reason"
          className={styles.input}
          maxLength={500}
          placeholder="Ex.: gabarito definitivo da banca alterou a resposta"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          required
        />
        <p className={styles.hint}>Fica registrado no histórico da questão, com seu nome e a data.</p>

        {props.isPublished && answerKeyChanged ? (
          <label className={styles.confirm}>
            <input
              type="checkbox"
              name="confirmAnswerKeyChange"
              checked={confirmKey}
              onChange={(event) => setConfirmKey(event.target.checked)}
            />
            <span>
              Confirmo a troca do gabarito de uma questão já publicada. Respostas anteriores de alunos
              foram corrigidas pelo gabarito antigo.
            </span>
          </label>
        ) : null}

        <SubmitButton pendingLabel="Salvando..." className={styles.primaryButton}>
          Salvar alterações
        </SubmitButton>
      </section>
    </form>
  );
}
