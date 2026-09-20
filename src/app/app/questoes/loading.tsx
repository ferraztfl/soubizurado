import styles from "./question-explorer.module.css";

export default function QuestionExplorerLoading() {
  return (
    <div
      className={styles.page}
      aria-busy="true"
      aria-label="Carregando questões"
    >
      <div
        style={{
          minHeight: 76,
          borderRadius: 18,
          background: "var(--sb-surface)",
          border: "1px solid var(--sb-border)",
        }}
      />

      <div
        style={{
          minHeight: 96,
          borderRadius: 18,
          background: "var(--sb-surface)",
          border: "1px solid var(--sb-border)",
        }}
      />

      <div className={styles.grid}>
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div
            key={item}
            style={{
              minHeight: 220,
              borderRadius: 18,
              background: "var(--sb-surface)",
              border: "1px solid var(--sb-border)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
