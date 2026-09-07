import styles from "./getting-started-card.module.css";

const steps = [
  {
    title: "Escolha uma disciplina",
    description:
      "Encontre o assunto que deseja treinar.",
  },
  {
    title: "Resolva questões",
    description:
      "Pratique no estilo da sua prova.",
  },
  {
    title: "Analise seu desempenho",
    description:
      "Descubra onde precisa melhorar.",
  },
] as const;

export function GettingStartedCard() {
  return (
    <article className={styles.card}>
      <span className={styles.eyebrow}>
        Para começar
      </span>

      <h2>Seu primeiro passo</h2>

      <div className={styles.steps}>
        {steps.map((step, index) => (
          <div
            key={step.title}
            className={styles.step}
          >
            <span
              className={
                index === 0
                  ? styles.activeNumber
                  : styles.number
              }
            >
              {index + 1}
            </span>

            <div>
              <strong>{step.title}</strong>
              <small>{step.description}</small>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
