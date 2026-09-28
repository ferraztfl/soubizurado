/*
 * Blog rules: post validation, scheduling, excerpts and the article format.
 * Articles use a small, safe Markdown subset (no HTML): "## " / "### "
 * headings, "- " and "1. " lists, "> " quotes, "[imagem N]" on its own line,
 * paragraphs separated by a blank line; inline **bold**, _italic_ and links
 * are handled by RichText.
 */

export const CALLOUT_KINDS = ["resumo", "atencao", "dica", "chamada"] as const;
export type CalloutKind = (typeof CALLOUT_KINDS)[number];

export type CalloutLine =
  | Readonly<{ type: "text"; text: string }>
  | Readonly<{ type: "item"; text: string }>
  /** A line that is only "[label](https://…)" — shown as a button. */
  | Readonly<{ type: "button"; label: string; href: string }>;

export type ArticleBlock =
  | Readonly<{ type: "heading"; level: 2 | 3; text: string }>
  | Readonly<{ type: "paragraph"; text: string }>
  | Readonly<{ type: "list"; ordered: boolean; items: readonly string[] }>
  | Readonly<{ type: "quote"; text: string }>
  | Readonly<{ type: "image"; index: number }>
  /** "!!! resumo Título" followed by lines (text, "- item" or a button link), no blank line inside. */
  | Readonly<{ type: "callout"; kind: CalloutKind; title: string; lines: readonly CalloutLine[] }>
  /** Lines "| a | b |"; the first row is the header, "|---|---|" rows are skipped. */
  | Readonly<{ type: "table"; header: readonly string[]; rows: readonly (readonly string[])[] }>;

const IMAGE_LINE = /^\[imagem\s+(\d{1,2})\]$/i;
const CALLOUT_LINE = /^!!!\s+(resumo|atencao|atenção|dica|chamada)\b\s*(.*)$/i;
const BUTTON_LINE = /^\[([^\]]{1,80})\]\((https:\/\/[^\s)]{1,300})\)$/;
const TABLE_SEPARATOR = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/;
const MAX_TABLE_COLUMNS = 8;
const MAX_TABLE_ROWS = 80;

function parseCallout(lines: readonly string[]): ArticleBlock | null {
  const match = lines[0]!.trim().match(CALLOUT_LINE);
  if (!match) return null;

  const kindText = match[1]!.toLowerCase().replace("ç", "c").replace("ã", "a");
  const kind = (CALLOUT_KINDS as readonly string[]).includes(kindText) ? (kindText as CalloutKind) : "resumo";

  return {
    type: "callout",
    kind,
    title: match[2]!.trim(),
    lines: lines.slice(1).map((raw): CalloutLine => {
      const line = raw.trim();
      const button = line.match(BUTTON_LINE);
      if (button) return { type: "button", label: button[1]!, href: button[2]! };
      if (/^[-*]\s+/.test(line)) return { type: "item", text: line.replace(/^[-*]\s+/, "") };
      return { type: "text", text: line };
    }),
  };
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim())
    .slice(0, MAX_TABLE_COLUMNS);
}

function parseTable(lines: readonly string[]): ArticleBlock | null {
  if (lines.length < 2 || !lines.every((line) => /^\s*\|.*\|\s*$/.test(line))) return null;

  const rows = lines.filter((line) => !TABLE_SEPARATOR.test(line.trim())).map(splitRow);
  const [header, ...body] = rows;
  if (!header || body.length === 0) return null;

  const width = header.length;
  return {
    type: "table",
    header,
    rows: body.slice(0, MAX_TABLE_ROWS).map((row) => Array.from({ length: width }, (_, index) => row[index] ?? "")),
  };
}

export function parseArticleBlocks(body: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  const chunks = body.replace(/\r\n/g, "\n").split(/\n{2,}/);

  for (const chunk of chunks) {
    const lines = chunk.split("\n").map((line) => line.trimEnd()).filter((line) => line.trim() !== "");
    if (lines.length === 0) continue;

    const first = lines[0]!.trim();
    const image = first.match(IMAGE_LINE);
    const special = parseCallout(lines) ?? parseTable(lines);

    if (special) {
      blocks.push(special);
    } else if (lines.length === 1 && image) {
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
    .replace(/^!!!\s+\S+\s*/gm, "")
    .replace(/^\s*\|?\s*:?-{3,}[\s:|-]*$/gm, "")
    .replace(/\|/g, " ")
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
  format?: string;
  stateCode?: string;
  isFeatured?: boolean;
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
  format: "NEWS" | "ARTICLE";
  stateCode: string | null;
  isFeatured: boolean;
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
      format: input.format === "ARTICLE" ? "ARTICLE" : "NEWS",
      stateCode: parseStateCode(input.stateCode),
      isFeatured: input.isFeatured === true,
    },
  };
}

/** Date as "YYYY-MM-DDTHH:mm" in São Paulo (for datetime-local inputs). */
export function toSaoPauloInput(date: Date | null): string {
  if (!date) return "";
  return new Date(date.getTime() - 3 * 3_600_000).toISOString().slice(0, 16);
}

export const BRAZIL_STATES = {
  AC: "Acre",
  AL: "Alagoas",
  AM: "Amazonas",
  AP: "Amapá",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MG: "Minas Gerais",
  MS: "Mato Grosso do Sul",
  MT: "Mato Grosso",
  PA: "Pará",
  PB: "Paraíba",
  PE: "Pernambuco",
  PI: "Piauí",
  PR: "Paraná",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RO: "Rondônia",
  RR: "Roraima",
  RS: "Rio Grande do Sul",
  SC: "Santa Catarina",
  SE: "Sergipe",
  SP: "São Paulo",
  TO: "Tocantins",
} as const;

export type StateCode = keyof typeof BRAZIL_STATES;

export function parseStateCode(value: string | null | undefined): StateCode | null {
  const code = (value ?? "").trim().toUpperCase();
  return Object.hasOwn(BRAZIL_STATES, code) ? (code as StateCode) : null;
}

export const POST_FORMATS = { NEWS: "Notícia", ARTICLE: "Artigo" } as const;

/** "Há 59 minutos", "Há uma hora", "Há 3 horas", then "24 de setembro" (São Paulo). */
export function relativePublishedAt(date: Date, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60_000));

  if (minutes < 1) return "Agora mesmo";
  if (minutes === 1) return "Há um minuto";
  if (minutes < 60) return `Há ${minutes} minutos`;

  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "Há uma hora";
  if (hours < 24) return `Há ${hours} horas`;

  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
    timeZone: "America/Sao_Paulo",
  }).format(date);
}
