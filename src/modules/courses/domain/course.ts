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
 * Video hosts we embed: Panda Video, Bunny Stream, Vimeo, YouTube
 * (privacy-enhanced) and Google Drive previews.
 */
const VIDEO_EMBED_PREFIXES = [
  "https://player.pandavideo.com.br/embed/",
  "https://iframe.mediadelivery.net/embed/",
  "https://player.vimeo.com/video/",
  "https://www.youtube-nocookie.com/embed/",
  "https://www.youtube.com/embed/",
  "https://drive.google.com/file/d/",
] as const;

const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/;

/**
 * Turns a link copied from the browser (YouTube watch / youtu.be / shorts,
 * Vimeo page, Google Drive share link) into the embed address of the player.
 * Anything else is returned as it came.
 */
export function toVideoEmbedUrl(value: string): string {
  const trimmed = value.trim();
  let url: URL;

  try {
    url = new URL(trimmed);
  } catch {
    return trimmed;
  }

  const host = url.hostname.replace(/^(www|m)\./, "");
  const startSeconds = Number.parseInt((url.searchParams.get("t") ?? url.searchParams.get("start") ?? "").replace(/s$/, ""), 10);
  const start = Number.isFinite(startSeconds) && startSeconds > 0 ? `?start=${startSeconds}` : "";
  const youtube = (id: string | null | undefined) =>
    id && YOUTUBE_ID.test(id) ? `https://www.youtube-nocookie.com/embed/${id}${start}` : null;

  if (host === "youtu.be") return youtube(url.pathname.split("/")[1]) ?? trimmed;

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const [, kind, id] = url.pathname.split("/");

    if (kind === "watch") return youtube(url.searchParams.get("v")) ?? trimmed;
    if (kind === "shorts" || kind === "live" || kind === "embed") return youtube(id) ?? trimmed;

    return trimmed;
  }

  if (host === "vimeo.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const id = parts.find((part) => /^[0-9]{6,12}$/.test(part));
    const hash = parts[parts.indexOf(id ?? "") + 1];

    if (id) return `https://player.vimeo.com/video/${id}${hash && /^[0-9a-f]{6,20}$/.test(hash) ? `?h=${hash}` : ""}`;

    return trimmed;
  }

  if (host === "drive.google.com") {
    const id = /^\/file\/d\/([A-Za-z0-9_-]{10,80})/.exec(url.pathname)?.[1] ?? url.searchParams.get("id");

    if (id && /^[A-Za-z0-9_-]{10,80}$/.test(id)) return `https://drive.google.com/file/d/${id}/preview`;
  }

  return trimmed;
}

/** Normalized embed URL, or null when it is not an allowed player. */
export function allowedVideoEmbedUrl(input: string): string | null {
  const trimmed = toVideoEmbedUrl(input);
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
