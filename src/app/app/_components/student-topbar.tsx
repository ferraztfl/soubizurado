"use client";

import { ReadingControls } from "./reading-controls";
import { planChipLabel, type StudentPlan } from "./student-plan";
import type { FontScale, StudentTheme } from "./reading-preferences";
import styles from "./student-topbar.module.css";

type StudentTopbarProps = Readonly<{
  firstName: string;
  plan: StudentPlan;
  onMenuClick: () => void;
  theme: StudentTheme;
  fontScale: FontScale;
  onThemeChange: (theme: StudentTheme) => void;
  onFontScaleChange: (scale: FontScale) => void;
}>;

export function StudentTopbar({
  firstName,
  plan,
  onMenuClick,
  theme,
  fontScale,
  onThemeChange,
  onFontScaleChange,
}: StudentTopbarProps) {
  const readingControls = (
    <ReadingControls
      theme={theme}
      fontScale={fontScale}
      onThemeChange={onThemeChange}
      onFontScaleChange={onFontScaleChange}
    />
  );

  return (
    <header className={styles.topbar}>
      <div className={styles.inner}>
        <div className={styles.desktopContent}>
          <div className={styles.greeting}>
            <span className={styles.eyebrow}>
              Área do aluno
            </span>

            <strong className={styles.title}>
              Olá, {firstName}
            </strong>
          </div>

          <div className={styles.statusGroup}>
            {readingControls}

            <span className={styles.planStatus}>
              {planChipLabel(plan)}
            </span>

            <div className={styles.accountStatus}>
              <span
                className={styles.statusDot}
                aria-hidden="true"
              />
              <span>Conta ativa</span>
            </div>
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
              Área do aluno
            </span>

            <strong className={styles.title}>
              Olá, {firstName}
            </strong>
          </div>

          <div className={styles.mobileControls}>{readingControls}</div>
        </div>
      </div>
    </header>
  );
}
