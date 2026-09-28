"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  useCallback,
  useMemo,
  useState,
} from "react";

import { MobileNavigationDrawer } from "./mobile-navigation-drawer";
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
import { StudentSidebar } from "./student-sidebar";
import { StudentTopbar } from "./student-topbar";

import styles from "../app-shell.module.css";

type StudentAppShellProps = Readonly<{
  children: ReactNode;
  displayName: string;
  email?: string;
  firstName: string;
  initialTheme: StudentTheme;
  initialFontScale: FontScale;
  plan: StudentPlan;
}>;

export function StudentAppShell({
  children,
  displayName,
  email,
  firstName,
  initialTheme,
  initialFontScale,
  plan,
}: StudentAppShellProps) {
  const [navigationOpen, setNavigationOpen] =
    useState(false);
  const [theme, setTheme] = useState(initialTheme);
  const [fontScale, setFontScale] = useState(initialFontScale);

  const openNavigation = useCallback(() => {
    setNavigationOpen(true);
  }, []);

  const closeNavigation = useCallback(() => {
    setNavigationOpen(false);
  }, []);

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
    <div
      className={styles.shell}
      data-theme={theme}
      // Question text sizes multiply by this (A− / A+).
      style={{ "--sb-reading-scale": fontScale / 100 } as CSSProperties}
    >
      <div className={styles.desktopSidebar}>
        <StudentSidebar
          displayName={displayName}
          email={email}
          firstName={firstName}
          plan={plan}
        />
      </div>

      <div className={styles.workspace}>
        <StudentTopbar
          firstName={firstName}
          plan={plan}
          onMenuClick={openNavigation}
          theme={theme}
          fontScale={fontScale}
          onThemeChange={changeTheme}
          onFontScaleChange={changeFontScale}
        />

        <main className={styles.content}>
          <ReadingPreferencesContext.Provider value={readingPreferences}>
            {children}
          </ReadingPreferencesContext.Provider>
        </main>
      </div>

      <MobileNavigationDrawer
        theme={theme}
        open={navigationOpen}
        onClose={closeNavigation}
      >
        <StudentSidebar
          displayName={displayName}
          email={email}
          firstName={firstName}
          plan={plan}
          onNavigate={closeNavigation}
        />
      </MobileNavigationDrawer>
    </div>
  );
}
