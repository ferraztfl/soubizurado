/*
 * Student highlights and notes in a lesson text. A highlight is stored as its
 * quote plus a few characters before/after it, so it is found again even if
 * the same words appear more than once. Pure functions.
 */

export const ANNOTATION_COLORS = ["yellow", "green", "blue", "pink"] as const;
export type AnnotationColor = (typeof ANNOTATION_COLORS)[number];

export const ANNOTATION_LIMITS = { quoteMax: 1000, contextMax: 64, noteMax: 2000, perLessonMax: 200 } as const;

export type AnnotationInput = Readonly<{ quote: string; prefix: string; suffix: string; note: string; color: string }>;

export type AnnotationPlan = Readonly<{ quote: string; prefix: string; suffix: string; note: string | null; color: AnnotationColor }>;

export function planAnnotation(input: AnnotationInput): AnnotationPlan | null {
  const quote = input.quote.replace(/\s+/g, " ").trim();
  if (quote.length < 1 || quote.length > ANNOTATION_LIMITS.quoteMax) return null;
  const note = input.note.trim();
  if (note.length > ANNOTATION_LIMITS.noteMax) return null;
  const color = (ANNOTATION_COLORS as readonly string[]).includes(input.color) ? (input.color as AnnotationColor) : "yellow";
  const context = (value: string) => value.replace(/\s+/g, " ").slice(-ANNOTATION_LIMITS.contextMax);
  return {
    quote,
    prefix: context(input.prefix),
    suffix: input.suffix.replace(/\s+/g, " ").slice(0, ANNOTATION_LIMITS.contextMax),
    note: note || null,
    color,
  };
}

/**
 * Start of the quote inside the (whitespace-collapsed) text: the occurrence
 * whose surroundings best match prefix/suffix; -1 when the quote is gone.
 */
export function locateQuote(text: string, annotation: Readonly<{ quote: string; prefix: string; suffix: string }>): number {
  const occurrences: number[] = [];
  for (let at = text.indexOf(annotation.quote); at >= 0; at = text.indexOf(annotation.quote, at + 1)) occurrences.push(at);
  if (occurrences.length <= 1) return occurrences[0] ?? -1;

  const score = (at: number) => {
    const before = text.slice(Math.max(0, at - annotation.prefix.length), at);
    const after = text.slice(at + annotation.quote.length, at + annotation.quote.length + annotation.suffix.length);
    let points = 0;
    for (let i = 1; i <= Math.min(before.length, annotation.prefix.length); i += 1) {
      if (before[before.length - i] !== annotation.prefix[annotation.prefix.length - i]) break;
      points += 1;
    }
    for (let i = 0; i < Math.min(after.length, annotation.suffix.length); i += 1) {
      if (after[i] !== annotation.suffix[i]) break;
      points += 1;
    }
    return points;
  };

  return occurrences.reduce((best, at) => (score(at) > score(best) ? at : best), occurrences[0]!);
}

/** 0–100, for "continuar de onde parei". */
export function clampScrollPercent(value: number): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0;
}
