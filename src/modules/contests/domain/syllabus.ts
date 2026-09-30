import { slugifyContest } from "./contest";

/*
 * "Edital verticalizado": what each position of a contest is tested on —
 * subjects with their number of questions and the numbered topics of the
 * official syllabus (Anexo II). It is the base for the "o que estudar" page,
 * the student's checklist, the platform mock exams and the theory courses.
 *
 * Typed in the admin as plain text:
 *
 *   # Língua Portuguesa | 10 | Bloco I
 *   1. Compreensão e interpretação de textos.
 *   2. Tipologias e gêneros textuais.
 *   # Direito Constitucional | 10
 *   1. Dos princípios fundamentais.
 *
 * The question count and the block are optional; topic numbers too.
 */

export const SYLLABUS_LIMITS = {
  titleMax: 160,
  subjectsMax: 40,
  subjectNameMax: 160,
  blockMax: 40,
  topicsPerSubjectMax: 200,
  topicTextMax: 600,
  topicCodeMax: 20,
  questionsMax: 500,
} as const;

export type SyllabusTopicPlan = Readonly<{ code: string | null; text: string }>;

export type SyllabusSubjectPlan = Readonly<{
  name: string;
  questionCount: number | null;
  block: string | null;
  topics: readonly SyllabusTopicPlan[];
}>;

export type SyllabusTextError = Readonly<{ line: number; reason: "SUBJECT" | "TOPIC_OUTSIDE_SUBJECT" | "TOPIC" | "TOO_MANY" }>;

const TOPIC_NUMBER = /^((?:\d{1,3}[.)])+(?:\d{1,3})?|[a-z]\))\s+/i;

/** Parses the admin text; returns the 1-based line of the first problem. */
export function parseSyllabusText(
  text: string,
): { ok: true; subjects: SyllabusSubjectPlan[] } | { ok: false; error: SyllabusTextError } {
  const subjects: { name: string; questionCount: number | null; block: string | null; topics: SyllabusTopicPlan[] }[] = [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");

  for (const [index, raw] of lines.entries()) {
    const line = raw.trim().replace(/\s+/g, " ");
    if (!line) continue;
    const at = index + 1;

    if (line.startsWith("#")) {
      const [name = "", countCell = "", blockCell = ""] = line
        .replace(/^#+\s*/, "")
        .split("|")
        .map((cell) => cell.trim());
      const questionCount = countCell ? Number(countCell) : null;
      if (
        name.length < 2 ||
        name.length > SYLLABUS_LIMITS.subjectNameMax ||
        blockCell.length > SYLLABUS_LIMITS.blockMax ||
        (questionCount !== null && (!Number.isInteger(questionCount) || questionCount < 0 || questionCount > SYLLABUS_LIMITS.questionsMax))
      ) {
        return { ok: false, error: { line: at, reason: "SUBJECT" } };
      }
      if (subjects.length >= SYLLABUS_LIMITS.subjectsMax) return { ok: false, error: { line: at, reason: "TOO_MANY" } };
      subjects.push({ name, questionCount, block: blockCell || null, topics: [] });
      continue;
    }

    const subject = subjects.at(-1);
    if (!subject) return { ok: false, error: { line: at, reason: "TOPIC_OUTSIDE_SUBJECT" } };

    const number = TOPIC_NUMBER.exec(line);
    const code = number ? number[1]!.replace(/[.)]$/, "") : null;
    const topicText = number ? line.slice(number[0].length).trim() : line;
    if (topicText.length < 2 || topicText.length > SYLLABUS_LIMITS.topicTextMax || (code !== null && code.length > SYLLABUS_LIMITS.topicCodeMax)) {
      return { ok: false, error: { line: at, reason: "TOPIC" } };
    }
    if (subject.topics.length >= SYLLABUS_LIMITS.topicsPerSubjectMax) return { ok: false, error: { line: at, reason: "TOO_MANY" } };
    subject.topics.push({ code, text: topicText });
  }

  return { ok: true, subjects };
}

/** Back to the editable text of the admin form. */
export function formatSyllabusText(subjects: readonly SyllabusSubjectPlan[]): string {
  return subjects
    .map((subject) => {
      const cells = [subject.name, subject.questionCount === null ? "" : String(subject.questionCount), subject.block ?? ""];
      while (cells.length > 1 && cells[cells.length - 1] === "") cells.pop();
      const topics = subject.topics.map((topic) =>
        topic.code ? `${topic.code}${/^[a-z]$/i.test(topic.code) ? ")" : "."} ${topic.text}` : topic.text,
      );
      return [`# ${cells.join(" | ")}`, ...topics].join("\n");
    })
    .join("\n\n");
}

/** Total objective questions, or null when no subject tells. */
export function totalQuestions(subjects: readonly Pick<SyllabusSubjectPlan, "questionCount">[]): number | null {
  const counts = subjects.map((subject) => subject.questionCount).filter((count): count is number => count !== null);
  return counts.length > 0 ? counts.reduce((sum, count) => sum + count, 0) : null;
}

export type SyllabusInput = Readonly<{
  title: string;
  slug: string;
  essayPoints: string;
  durationMinutes: string;
  notes: string;
  text: string;
  isPublished: boolean;
}>;

export type SyllabusError = "TITLE_REQUIRED" | "SLUG_INVALID" | "ESSAY_INVALID" | "DURATION_INVALID" | "NOTES_TOO_LONG" | "TEXT_EMPTY";

export type SyllabusPlan = Readonly<{
  title: string;
  slug: string;
  essayPoints: number | null;
  durationMinutes: number | null;
  notes: string;
  isPublished: boolean;
  subjects: readonly SyllabusSubjectPlan[];
}>;

function optionalInteger(value: string, max: number): number | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const number = Number(trimmed);
  return Number.isInteger(number) && number >= 0 && number <= max ? number : undefined;
}

/** Validates one position's syllabus (the subjects text must already be parsed without errors). */
export function planSyllabus(
  input: SyllabusInput,
): { ok: true; syllabus: SyllabusPlan } | { ok: false; error: SyllabusError } | { ok: false; error: "TEXT_INVALID"; detail: SyllabusTextError } {
  const title = input.title.trim().replace(/\s+/g, " ");
  if (title.length < 2 || title.length > SYLLABUS_LIMITS.titleMax) return { ok: false, error: "TITLE_REQUIRED" };

  const slug = slugifyContest(input.slug.trim() || title).slice(0, 80).replace(/-+$/g, "");
  if (!slug) return { ok: false, error: "SLUG_INVALID" };

  const essayPoints = optionalInteger(input.essayPoints, 1000);
  if (essayPoints === undefined) return { ok: false, error: "ESSAY_INVALID" };
  const durationMinutes = optionalInteger(input.durationMinutes, 1440);
  if (durationMinutes === undefined) return { ok: false, error: "DURATION_INVALID" };

  const notes = input.notes.trim();
  if (notes.length > 2000) return { ok: false, error: "NOTES_TOO_LONG" };

  const parsed = parseSyllabusText(input.text);
  if (!parsed.ok) return { ok: false, error: "TEXT_INVALID", detail: parsed.error };
  if (parsed.subjects.length === 0) return { ok: false, error: "TEXT_EMPTY" };

  return { ok: true, syllabus: { title, slug, essayPoints, durationMinutes, notes, isPublished: input.isPublished, subjects: parsed.subjects } };
}

/** Share of the topics a student marked as studied (0–100, rounded down). */
export function studiedPercent(studied: number, total: number): number {
  return total > 0 ? Math.floor((Math.min(studied, total) / total) * 100) : 0;
}
