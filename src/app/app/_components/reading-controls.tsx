"use client";

import {
  FONT_SCALE_STEPS,
  type FontScale,
  type StudentTheme,
} from "./reading-preferences";

import styles from "./reading-controls.module.css";

type ReadingControlsProps = Readonly<{
  theme: StudentTheme;
  fontScale: FontScale;
  onThemeChange: (theme: StudentTheme) => void;
  onFontScaleChange: (scale: FontScale) => void;
}>;

/** A− / A+ for the question text and the light / dark switch. */
export function ReadingControls({ theme, fontScale, onThemeChange, onFontScaleChange }: ReadingControlsProps) {
  const index = FONT_SCALE_STEPS.indexOf(fontScale);
  const smaller = FONT_SCALE_STEPS[index - 1];
  const larger = FONT_SCALE_STEPS[index + 1];

  return (
    <div className={styles.controls} role="group" aria-label="Preferências de leitura">
      <button
        type="button"
        className={styles.button}
        onClick={() => smaller && onFontScaleChange(smaller)}
        disabled={!smaller}
        aria-label="Diminuir o texto das questões"
        title="Diminuir texto"
      >
        A−
      </button>
      <button
        type="button"
        className={`${styles.button} ${styles.larger}`}
        onClick={() => larger && onFontScaleChange(larger)}
        disabled={!larger}
        aria-label="Aumentar o texto das questões"
        title="Aumentar texto"
      >
        A+
      </button>
      <button
        type="button"
        className={styles.button}
        onClick={() => onThemeChange(theme === "dark" ? "light" : "dark")}
        aria-pressed={theme === "dark"}
        aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}
        title={theme === "dark" ? "Tema claro" : "Tema escuro"}
      >
        {theme === "dark" ? (
          <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
            <circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path
              d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
            <path
              d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
