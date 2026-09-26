import styles from "./attention-card.module.css";

const placeholders = [
  "Erros recentes",
  "Assuntos com menor precisão",
  "Questões para revisar",
] as const;

export function AttentionCard() {
  return (
    <article className={styles.card}>
      <span className={styles.eyebrow}>
        Pontos de atenção
      </span>

      <h2>Onde focar agora</h2>

      <p className={styles.description}>
        Depois das primeiras respostas, mostraremos aqui os assuntos que mais
        precisam de revisão.
      </p>

      <div className={styles.items}>
        {placeholders.map((item) => (
          <div
            key={item}
            className={styles.item}
          >
            <span className={styles.dot} aria-hidden="true" />

            <div>
              <strong>{item}</strong>
              <small>Aguardando dados de estudo</small>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
