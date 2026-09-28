/*
 * Member-area rules: lesson validation, allowed video players, curated
 * question lists and progress. Pure functions.
 */

export const LESSON_KINDS = {
  TEXT: "Texto",
  PDF: "PDF",
  VIDEO: "Vídeo",
  QUESTIONS: "Questões",
} as const;

export type LessonKind = keyof typeof LESSON_KINDS;

export function isLessonKind(value: string): value is LessonKind {
  return Object.hasOwn(LESSON_KINDS, value);
}

/**
 * Video hosts we embed (the provider is chosen later; any of these works):
 * Panda Video, Bunny Stream, Vimeo and YouTube (privacy-enhanced).
 */
const VIDEO_EMBED_PREFIXES = [
  "https://player.pandavideo.com.br/embed/",
  "https://iframe.mediadelivery.net/embed/",
  "https://player.vimeo.com/video/",
  "https://www.youtube-nocookie.com/embed/",
  "https://www.youtube.com/embed/",
] as const;

/** Normalized embed URL, or null when it is not an allowed player. */
export function allowedVideoEmbedUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || url.username || url.password) return null;

  const normalized = url.toString();
  // Panda Video players live on per-account hosts (player-vz-….tv.pandavideo.com.br).
  const pandaHost = /^player-vz-[a-z0-9-]+\.tv\.pandavideo\.com\.br$/.test(url.hostname) && url.pathname.startsWith("/embed/");
  const allowed = pandaHost || VIDEO_EMBED_PREFIXES.some((prefix) => normalized.startsWith(prefix));

  return allowed && normalized.length <= 500 ? normalized : null;
}

/** "Q100001, q100002\n100003" → [100001, 100002, 100003] (distinct, in order, at most 200). */
export function parseQuestionCodes(text: string): number[] {
  const numbers = [...text.matchAll(/q?(\d{5,9})/gi)].map((match) => Number(match[1]));
  return [...new Set(numbers)].slice(0, 200);
}

export type LessonInput = Readonly<{
  title: string;
  kind: string;
  body: string;
  videoEmbedUrl: string;
  durationMinutes: string;
}>;

export type LessonError = "TITLE_REQUIRED" | "KIND_INVALID" | "VIDEO_URL_INVALID" | "DURATION_INVALID" | "BODY_TOO_LONG";

export type LessonPlan = Readonly<{
  title: string;
  kind: LessonKind;
  body: string;
  videoEmbedUrl: string | null;
  durationMinutes: number | null;
}>;

export function planLesson(input: LessonInput): { ok: true; lesson: LessonPlan } | { ok: false; error: LessonError } {
  const title = input.title.replace(/\s+/g, " ").trim();
  const body = input.body.replace(/\r\n/g, "\n").trim();
  const duration = input.durationMinutes.trim();

  if (title.length < 2 || title.length > 160) return { ok: false, error: "TITLE_REQUIRED" };
  if (!isLessonKind(input.kind)) return { ok: false, error: "KIND_INVALID" };
  if (body.length > 100_000) return { ok: false, error: "BODY_TOO_LONG" };

  let videoEmbedUrl: string | null = null;
  if (input.videoEmbedUrl.trim()) {
    videoEmbedUrl = allowedVideoEmbedUrl(input.videoEmbedUrl);
    if (!videoEmbedUrl) return { ok: false, error: "VIDEO_URL_INVALID" };
  }

  let durationMinutes: number | null = null;
  if (duration) {
    durationMinutes = Number(duration);
    if (!Number.isSafeInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) {
      return { ok: false, error: "DURATION_INVALID" };
    }
  }

  return { ok: true, lesson: { title, kind: input.kind, body, videoEmbedUrl, durationMinutes } };
}

export function progressPercent(total: number, completed: number): number {
  return total === 0 ? 0 : Math.round((Math.min(completed, total) / total) * 100);
}

/** Lesson after `currentId` in course order, or null at the end. */
export function nextLessonId(orderedIds: readonly string[], currentId: string): string | null {
  const index = orderedIds.indexOf(currentId);
  return index === -1 || index === orderedIds.length - 1 ? null : orderedIds[index + 1]!;
}

export function slugifyCourse(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}
