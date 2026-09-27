import type { ReactNode } from "react";

import styles from "./empty-state.module.css";

type EmptyStateProps = Readonly<{
  title: string;
  description: string;
  icon?: ReactNode;
  /** Optional call to action below the description (e.g. a link). */
  action?: ReactNode;
}>;

export function EmptyState({
  title,
  description,
  icon,
  action,
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
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
