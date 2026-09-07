"use client";

import styles from "./student-topbar.module.css";

type StudentTopbarProps = Readonly<{
  firstName: string;
  onMenuClick: () => void;
}>;

export function StudentTopbar({
  firstName,
  onMenuClick,
}: StudentTopbarProps) {
  return (
    <header className={styles.topbar}>
      <div className={styles.inner}>
        <div className={styles.desktopContent}>
          <div className={styles.greeting}>
            <span className={styles.eyebrow}>
              ÁREA DO ALUNO
            </span>

            <strong className={styles.title}>
              Olá, {firstName}
            </strong>
          </div>

          <div className={styles.accountStatus}>
            <span
              className={styles.statusDot}
              aria-hidden="true"
            />

            <span>
              Conta ativa
            </span>
          </div>
        </div>

        <div className={styles.mobileContent}>
          <button
            type="button"
            className={styles.menuButton}
            aria-label="Abrir menu principal"
            aria-controls="student-mobile-navigation"
            onClick={onMenuClick}
          >
            <span />
            <span />
            <span />
          </button>

          <div className={styles.greeting}>
            <span className={styles.eyebrow}>
              ÁREA DO ALUNO
            </span>

            <strong className={styles.title}>
              Olá, {firstName}
            </strong>
          </div>
        </div>
      </div>
    </header>
  );
}
