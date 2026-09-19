import type { ReactNode } from "react";

import styles from "./page-header.module.css";

type PageHeaderProps = Readonly<{
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}>;

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.copy}>
        {eyebrow ? (
          <span className={styles.eyebrow}>
            {eyebrow}
          </span>
        ) : null}

        <h1>{title}</h1>

        {description ? (
          <p>{description}</p>
        ) : null}
      </div>

      {actions ? (
        <div className={styles.actions}>
          {actions}
        </div>
      ) : null}
    </header>
  );
}
