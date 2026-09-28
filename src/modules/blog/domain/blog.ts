/*
 * Blog rules: post validation, scheduling, excerpts and the article format.
 * Articles use a small, safe Markdown subset (no HTML): "## " / "### "
 * headings, "- " and "1. " lists, "> " quotes, "[imagem N]" on its own line,
 * paragraphs separated by a blank line; inline **bold**, _italic_ and links
 * are handled by RichText.
 */

export type ArticleBlock =
  | Readonly<{ type: "heading"; level: 2 | 3; text: string }>
  | Readonly<{ type: "paragraph"; text: string }>
  | Readonly<{ type: "list"; ordered: boolean; items: readonly string[] }>
  | Readonly<{ type: "quote"; text: string }>
  | Readonly<{ type: "image"; index: number }>;

const IMAGE_LINE = /^\[imagem\s+(\d{1,2})\]$/i;

export function parseArticleBlocks(body: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  const chunks = body.replace(/\r\n/g, "\n").split(/\n{2,}/);

  for (const chunk of chunks) {
    const lines = chunk.split("\n").map((line) => line.trimEnd()).filter((line) => line.trim() !== "");
    if (lines.length === 0) continue;

    const first = lines[0]!.trim();
    const image = first.match(IMAGE_LINE);

    if (lines.length === 1 && image) {
      blocks.push({ type: "image", index: Number(image[1]) });
    } else if (lines.length === 1 && /^###\s+/.test(first)) {
      blocks.push({ type: "heading", level: 3, text: first.replace(/^###\s+/, "") });
    } else if (lines.length === 1 && /^##\s+/.test(first)) {
      blocks.push({ type: "heading", level: 2, text: first.replace(/^##\s+/, "") });
    } else if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
      blocks.push({ type: "list", ordered: false, items: lines.map((line) => line.replace(/^\s*[-*]\s+/, "")) });
    } else if (lines.every((line) => /^\s*\d{1,3}[.)]\s+/.test(line))) {
      blocks.push({ type: "list", ordered: true, items: lines.map((line) => line.replace(/^\s*\d{1,3}[.)]\s+/, "")) });
    } else if (lines.every((line) => /^\s*>/.test(line))) {
      blocks.push({ type: "quote", text: lines.map((line) => line.replace(/^\s*>\s?/, "")).join("\n") });
    } else {
      blocks.push({ type: "paragraph", text: lines.join("\n") });
    }
  }

  return blocks;
}

/** Plain text of an article (for excerpts, reading time and search). */
export function articlePlainText(body: string): string {
  return body
    .replace(/\[imagem\s+\d{1,2}\]/gi, " ")
    .replace(/^#{2,3}\s+/gm, "")
    .replace(/^\s*(?:[-*>]|\d{1,3}[.)])\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function excerptOf(body: string, max = 300): string {
  const text = articlePlainText(body);
  return text.length <= max ? text : `${text.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

export function readingMinutes(body: string): number {
  const words = articlePlainText(body).split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function isPostVisible(status: string, publishedAt: Date | null, now: Date): boolean {
  return status === "PUBLISHED" && publishedAt !== null && publishedAt.getTime() <= now.getTime();
}

export function slugifyPost(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160)
    .replace(/-+$/, "");
}

export type PostInput = Readonly<{
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  status: string;
  /** "YYYY-MM-DDTHH:mm" in São Paulo time (datetime-local); blank = now when publishing. */
  publishAt: string;
  categoryName: string;
}>;

export type PostError = "TITLE_REQUIRED" | "SLUG_INVALID" | "BODY_REQUIRED" | "TEXT_TOO_LONG" | "DATE_INVALID" | "CATEGORY_INVALID";

export type PostPlan = Readonly<{
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: Date | null;
  category: Readonly<{ name: string; slug: string }> | null;
}>;

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function planPost(input: PostInput, now: Date): { ok: true; post: PostPlan } | { ok: false; error: PostError } {
  const title = input.title.replace(/\s+/g, " ").trim();
  const slug = (input.slug.trim() || slugifyPost(title)).toLowerCase();
  const body = input.body.replace(/\r\n/g, "\n").trim();
  const excerptInput = input.excerpt.replace(/\s+/g, " ").trim();
  const categoryName = input.categoryName.replace(/\s+/g, " ").trim();
  const status = input.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT";

  if (title.length < 5 || title.length > 200) return { ok: false, error: "TITLE_REQUIRED" };
  if (!SLUG.test(slug) || slug.length > 160) return { ok: false, error: "SLUG_INVALID" };
  if (articlePlainText(body).length < 20) return { ok: false, error: "BODY_REQUIRED" };
  if (body.length > 200_000 || excerptInput.length > 320) return { ok: false, error: "TEXT_TOO_LONG" };
  if (categoryName && (categoryName.length > 120 || !slugifyPost(categoryName))) return { ok: false, error: "CATEGORY_INVALID" };

  let publishedAt: Date | null = null;
  const when = input.publishAt.trim();

  if (when) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(when)) return { ok: false, error: "DATE_INVALID" };
    // São Paulo is UTC−3 (no DST since 2019).
    publishedAt = new Date(`${when}:00-03:00`);
    if (Number.isNaN(publishedAt.getTime())) return { ok: false, error: "DATE_INVALID" };
  } else if (status === "PUBLISHED") {
    publishedAt = now;
  }

  return {
    ok: true,
    post: {
      title,
      slug,
      excerpt: excerptInput || excerptOf(body),
      body,
      status,
      publishedAt,
      category: categoryName ? { name: categoryName, slug: slugifyPost(categoryName) } : null,
    },
  };
}

/** Date as "YYYY-MM-DDTHH:mm" in São Paulo (for datetime-local inputs). */
export function toSaoPauloInput(date: Date | null): string {
  if (!date) return "";
  return new Date(date.getTime() - 3 * 3_600_000).toISOString().slice(0, 16);
}
