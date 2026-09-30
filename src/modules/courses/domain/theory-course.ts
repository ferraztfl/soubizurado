/*
 * "Teoria Completa": a course built from a position's edital verticalizado —
 * one module per subject, one lesson per syllabus topic, in the notice order.
 * Lessons start EMPTY; text written by AI enters as DRAFT and only a person
 * marks it REVIEWED. Pure functions.
 */

export const LESSON_CONTENT_STATUSES = {
  EMPTY: "A escrever",
  DRAFT: "Rascunho (revisar)",
  REVIEWED: "Revisada",
} as const;

export type LessonContentStatus = keyof typeof LESSON_CONTENT_STATUSES;

export function isLessonContentStatus(value: string): value is LessonContentStatus {
  return Object.hasOwn(LESSON_CONTENT_STATUSES, value);
}

export const THEORY_PRODUCT_NAME = "Teoria Completa";

function fold(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugPart(value: string): string {
  return fold(value).replace(/ /g, "-");
}

/** "concurso-pmpe-2026" + "soldado" → "teoria-completa-pmpe-2026-soldado". */
export function theoryCourseSlug(contestSlug: string, syllabusSlug: string): string {
  return `teoria-completa-${slugPart(contestSlug.replace(/^concurso-/, ""))}-${slugPart(syllabusSlug)}`.slice(0, 120).replace(/-+$/, "");
}

/** "Concurso PMPE 2026" + "Soldado (Praça QPMG)" → "Teoria Completa – PMPE 2026 – Soldado (Praça QPMG)". */
export function theoryCourseTitle(contestName: string, syllabusTitle: string): string {
  const contest = contestName.replace(/^concurso\s+/i, "").trim();
  return `${THEORY_PRODUCT_NAME} – ${contest} – ${syllabusTitle}`.slice(0, 160);
}

const TITLE_MAX = 150;

/**
 * Lesson title from a syllabus topic: the heading before ":" when it reads as a
 * title ("Doenças cardiovasculares: hipertensão…" → "Doenças cardiovasculares"),
 * else the text cut at a word boundary.
 */
export function lessonTitleFromTopic(topicText: string): string {
  const text = topicText.replace(/\s+/g, " ").trim().replace(/[.;]+$/, "");
  const colon = text.indexOf(":");
  if (colon >= 8 && colon <= TITLE_MAX) return text.slice(0, colon).trim();
  if (text.length <= TITLE_MAX) return text;
  const cut = text.slice(0, TITLE_MAX);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 40)).replace(/[,;:–-]+$/, "").trim()}…`;
}

/** Same subject and same topic text → same lesson content (reused across positions and contests). */
export function lessonContentKey(subjectName: string, topicText: string): string {
  return `${fold(subjectName)}|${fold(topicText)}`;
}

export type SyllabusForCourse = Readonly<{
  subjects: readonly Readonly<{
    name: string;
    topics: readonly Readonly<{ id: string; code: string | null; text: string }>[];
  }>[];
}>;

export type PlannedTheoryModule = Readonly<{
  title: string;
  lessons: readonly Readonly<{ title: string; syllabusTopicId: string; contentKey: string }>[];
}>;

/** Modules and lessons of the course, in the notice order (subjects without topics are left out). */
export function planTheoryCourse(syllabus: SyllabusForCourse): PlannedTheoryModule[] {
  return syllabus.subjects
    .filter((subject) => subject.topics.length > 0)
    .map((subject) => ({
      title: subject.name.slice(0, 160),
      lessons: subject.topics.map((topic) => ({
        title: `${topic.code ? `${topic.code}. ` : ""}${lessonTitleFromTopic(topic.text)}`.slice(0, 160),
        syllabusTopicId: topic.id,
        contentKey: lessonContentKey(subject.name, topic.text),
      })),
    }));
}
