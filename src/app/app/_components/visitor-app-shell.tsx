"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";

import { FREE_DAILY_ANSWERS } from "@/modules/study/domain/access";

import { ReadingControls } from "./reading-controls";
import { ReadingPreferencesContext } from "./reading-preferences-context";
import {
  FONT_SCALE_COOKIE,
  savePreferenceCookie,
  THEME_COOKIE,
  themeCookieValue,
  type FontScale,
  type StudentTheme,
} from "./reading-preferences";
import type { StudentPlan } from "./student-plan";

import styles from "./visitor-app-shell.module.css";

type VisitorAppShellProps = Readonly<{
  children: ReactNode;
  /** Server-rendered site header, footer and Premium bar (same as the public pages). */
  header: ReactNode;
  footer: ReactNode;
  bottomBar: ReactNode;
  initialTheme: StudentTheme;
  initialFontScale: FontScale;
  plan: StudentPlan;
}>;

/** Public question bank for signed-out visitors: the site's header and footer instead of the student sidebar. */
export function VisitorAppShell({ children, header, footer, bottomBar, initialTheme, initialFontScale, plan }: VisitorAppShellProps) {
  const [theme, setTheme] = useState(initialTheme);
  const [fontScale, setFontScale] = useState(initialFontScale);

  const changeTheme = useCallback((next: StudentTheme) => {
    setTheme(next);
    savePreferenceCookie(THEME_COOKIE, themeCookieValue(next));
  }, []);

  const changeFontScale = useCallback((next: FontScale) => {
    setFontScale(next);
    savePreferenceCookie(FONT_SCALE_COOKIE, String(next));
  }, []);

  const readingPreferences = useMemo(
    () => ({ theme, fontScale, changeTheme, changeFontScale }),
    [theme, fontScale, changeTheme, changeFontScale],
  );

  return (
    <div className={styles.shell} data-theme={theme} style={{ "--sb-reading-scale": fontScale / 100 } as CSSProperties}>
      {header}

      <div className={styles.bar}>
        <div className={styles.barInner}>
          <p>
            <strong>{plan.remaining !== null && plan.remaining > 0 ? "Você tem 1 resposta grátis hoje." : "Você já usou a resposta grátis de hoje."}</strong>
            <span>Com a conta grátis são {FREE_DAILY_ANSWERS.free} por dia; no Premium, ilimitadas.</span>
          </p>
          <div className={styles.barActions}>
            <ReadingControls theme={theme} fontScale={fontScale} onThemeChange={changeTheme} onFontScaleChange={changeFontScale} />
            <Link href="/cadastro" className={styles.cta}>
              Criar conta grátis
            </Link>
          </div>
        </div>
      </div>

      <main className={styles.content}>
        <ReadingPreferencesContext.Provider value={readingPreferences}>{children}</ReadingPreferencesContext.Provider>
      </main>

      {footer}
      {bottomBar}
    </div>
  );
}
