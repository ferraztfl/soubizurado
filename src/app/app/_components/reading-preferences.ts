/*
 * Student reading preferences, kept in cookies so the server renders them
 * straight away (no flash of the light theme or of the default font size).
 */

export const THEME_COOKIE = "sb_tema";
export const FONT_SCALE_COOKIE = "sb_fonte";
export const SIDEBAR_COOKIE = "sb_menu";

/** Desktop sidebar: "recolhido" shows only the icons. */
export function parseSidebarCollapsed(value: string | undefined): boolean {
  return value === "recolhido";
}

export type StudentTheme = "light" | "dark";

/** Percent steps for the question text (A− / A+). */
export const FONT_SCALE_STEPS = [90, 100, 112, 125, 140] as const;
export type FontScale = (typeof FONT_SCALE_STEPS)[number];
export const DEFAULT_FONT_SCALE: FontScale = 100;

export function parseTheme(value: string | undefined): StudentTheme {
  return value === "escuro" ? "dark" : "light";
}

export function themeCookieValue(theme: StudentTheme): string {
  return theme === "dark" ? "escuro" : "claro";
}

export function parseFontScale(value: string | undefined): FontScale {
  const parsed = Number(value);

  return FONT_SCALE_STEPS.find((step) => step === parsed) ?? DEFAULT_FONT_SCALE;
}

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

/** Browser only. */
export function savePreferenceCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${ONE_YEAR_IN_SECONDS}; SameSite=Lax`;
}
