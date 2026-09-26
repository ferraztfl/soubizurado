import styles from "./error-state.module.css";

type ErrorStateProps = Readonly<{
  title?: string;
  description?: string;
}>;

export function ErrorState({
  title = "Não foi possível carregar esta área",
  description = "Tente novamente em alguns instantes. Se o problema continuar, volte para o início e tente novamente.",
}: ErrorStateProps) {
  return (
    <div
      className={styles.error}
      role="alert"
    >
      <div
        className={styles.icon}
        aria-hidden="true"
      >
        !
      </div>

      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}
