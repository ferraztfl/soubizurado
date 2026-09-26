/*
 * Board-agnostic representation of an official exam booklet after
 * parsing and answer-key matching. Every board parser produces this;
 * the preview, the import provider and the UI only depend on it.
 */

export const OFFICIAL_EXAM_BOARDS = {
  AOCP: "Instituto AOCP",
  FUNDATEC: "Fundatec",
  CEBRASPE: "Cebraspe",
} as const;

export type OfficialExamBoard = keyof typeof OFFICIAL_EXAM_BOARDS;

export type OfficialExamAlternative = Readonly<{
  label: string;
  content: string;
  /** Image file names inside the analysis workspace. */
  images: readonly string[];
}>;

export type OfficialExamQuestion = Readonly<{
  /** Stable key inside the booklet: "12" or "12-v2" for variants. */
  key: string;
  number: number;
  variant: number;
  block: string | null;
  section: string | null;
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE";
  statement: string;
  images: readonly string[];
  supportText: string | null;
  supportImages: readonly string[];
  alternatives: readonly OfficialExamAlternative[];
  /** "A".."E" for multiple choice, "C"/"E" for true/false. */
  answer: string | null;
  annulled: boolean;
  refersToHighlight: boolean;
}>;

export type OfficialExamMetadata = Readonly<{
  board: OfficialExamBoard;
  organization: string;
  careerPosition: string;
  year: number;
  level: string | null;
  notice: string | null;
  title: string;
}>;

export type DetectedExamMetadata = Readonly<{
  organization: string | null;
  careerPosition: string | null;
  year: number | null;
  level: string | null;
  notice: string | null;
}>;

export type OfficialExamAnalysis = Readonly<{
  version: 1;
  uploadId: string;
  createdAt: string;
  board: OfficialExamBoard | null;
  bookletChecksum: string;
  answerKeyChecksum: string;
  bookletFileName: string;
  answerKeyFileName: string;
  detected: DetectedExamMetadata;
  sections: readonly string[];
  questions: readonly OfficialExamQuestion[];
  /** Problems that block the import until fixed. */
  blockingIssues: readonly string[];
}>;

export function questionKey(number: number, variant: number): string {
  return variant > 0 ? `${number}-v${variant + 1}` : String(number);
}

export function examSlug(metadata: OfficialExamMetadata, checksum: string): string {
  const base = [metadata.board, metadata.organization, metadata.careerPosition, metadata.year]
    .join(" ")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);

  return `${base}-${checksum.slice(0, 8)}`;
}
