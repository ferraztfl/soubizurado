import type { ImportPhase } from "@/modules/contests/domain/import-progress";

import type { ContestFormValues } from "../contest-form";

/** What a finished notice import hands to the review screen. */
export type NoticeImportResult = Readonly<{
  /** Changes every import, so the prefilled form remounts. */
  key: string;
  values: ContestFormValues;
  news: Readonly<{ title: string; excerpt: string; body: string }> | null;
  warnings: readonly string[];
  usage: Readonly<{ inputTokens: number; outputTokens: number; provider: "local" | "remote"; seconds: number }>;
}>;

/** Answer of GET /api/admin/notice-import/[jobId]. */
export type NoticeImportStatus = Readonly<{
  phase: ImportPhase;
  label: string;
  percent: number;
  elapsedSeconds: number;
  remainingSeconds: number | null;
  provider: "local" | "remote";
  result: NoticeImportResult | null;
  error: string | null;
}>;
