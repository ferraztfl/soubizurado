"use client";

import { ErrorState } from "@/shared/ui/error-state";

import styles from "./question-explorer.module.css";

type QuestionExplorerErrorProps = Readonly<{
  error: Error & {
    digest?: string;
  };
  reset: () => void;
}>;

export default function QuestionExplorerError({
  reset,
}: QuestionExplorerErrorProps) {
  return (
    <div className={styles.page}>
      <ErrorState
        title="Não foi possível carregar as questões"
        description="O banco de questões não respondeu como esperado. Tente novamente para refazer a consulta."
      />

      <button
        type="button"
        onClick={reset}
        style={{
          alignSelf: "center",
          minHeight: 40,
          padding: "0 14px",
          border: "1px solid var(--sb-brand)",
          borderRadius: 10,
          background: "var(--sb-brand)",
          color: "#fff",
          fontSize: 10,
          fontWeight: 760,
          cursor: "pointer",
        }}
      >
        Tentar novamente
      </button>
    </div>
  );
}
