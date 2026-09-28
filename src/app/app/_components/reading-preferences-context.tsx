"use client";

import { createContext, useContext } from "react";

import type { FontScale, StudentTheme } from "./reading-preferences";

export type ReadingPreferencesValue = Readonly<{
  theme: StudentTheme;
  fontScale: FontScale;
  changeTheme: (next: StudentTheme) => void;
  changeFontScale: (next: FontScale) => void;
}>;

/** Theme and text size of the student shell, for pages that change them (Configurações). */
export const ReadingPreferencesContext = createContext<ReadingPreferencesValue | null>(null);

export function useReadingPreferences(): ReadingPreferencesValue {
  const value = useContext(ReadingPreferencesContext);

  if (!value) {
    throw new Error("useReadingPreferences must be used inside the student app shell.");
  }

  return value;
}
