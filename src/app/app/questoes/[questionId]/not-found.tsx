import Link from "next/link";

import { EmptyState } from "@/shared/ui/empty-state";

import styles from "./question-detail.module.css";

export default function QuestionNotFound() {
  return (
    <div className={styles.page}>
      <div
        style={{
          border: "1px solid var(--sb-border)",
          borderRadius: "var(--sb-radius-lg)",
          background: "var(--sb-surface)",
        }}
      >
        <EmptyState
          icon="?"
          title="Questão não encontrada"
          description="Ela pode não existir, ter sido arquivada ou ainda não estar publicada."
        />
      </div>

      <Link
        href="/app/questoes"
        className={styles.back}
        style={{ alignSelf: "center" }}
      >
        Voltar para questões
      </Link>
    </div>
  );
}
