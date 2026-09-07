export const MODULE_NAMES = [
  "identity",
  "taxonomy",
  "exams",
  "question-bank",
  "study",
  "analytics",
  "comments",
  "media",
  "imports",
  "billing",
  "store",
  "blog",
  "administration",
] as const;

export type ModuleName = (typeof MODULE_NAMES)[number];