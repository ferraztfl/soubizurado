import type { ReactNode } from "react";

import styles from "./empty-state.module.css";

type EmptyStateProps = Readonly<{
  title: string;
  description: string;
  icon?: ReactNode;
}>;

export function EmptyState({
  title,
  description,
  icon,
}: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <div
        className={styles.icon}
        aria-hidden="true"
      >
        {icon ?? "—"}
      </div>

      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}
