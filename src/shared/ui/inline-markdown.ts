/*
 * Minimal, safe inline Markdown for imported question texts.
 *
 * Supported: **bold**, _italic_ (word-delimited, so snake_case and URLs
 * are untouched), [label](http(s) link) and backslash escapes (\+ → +).
 * Markdown images are rendered only when the caller maps their source URL
 * to a local copy (remote images must never be hot-linked); otherwise they
 * are removed, and the question media component shows the local copy.
 *
 * Produces plain data; rendering creates React elements, never HTML
 * strings, so imported text cannot inject markup.
 */

export type InlineNode =
  | Readonly<{ type: "text"; value: string; bold: boolean; italic: boolean }>
  | Readonly<{ type: "link"; label: string; href: string }>
  /** inline: glued to text on its line (a symbol); otherwise a figure. */
  | Readonly<{ type: "image"; src: string; alt: string; inline: boolean }>;

/** Source URL of an imported image → local URL of its stored copy. */
export type InlineImageMap = Readonly<Record<string, string>>;

const IMAGE = /!\[[^\]\n]*\]\([^)\s]*\)/g;
const IMAGE_PARTS = /!\[([^\]\n]*)\]\(([^)\s]*)\)/g;
const ESCAPE = /\\([\\`*_{}[\]()#+\-.!|~=<>^])/g;

// Order matters: link, bold, italic. Italic keeps its left delimiter in
// group 5 so it can be re-emitted as plain text.
const TOKEN =
  /\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)|\*\*([^*\n]+?)\*\*|(^|[\s(])_([^_\s](?:[^_\n]*?[^_\s])?)_(?=[\s).,;:!?]|$)/gm;

export function removeMarkdownImages(text: string): string {
  return text
    .replace(IMAGE, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pushText(
  nodes: InlineNode[],
  rawValue: string,
  bold: boolean,
  italic: boolean,
): void {
  const value = rawValue.replace(ESCAPE, "$1");

  if (!value) {
    return;
  }

  const previous = nodes[nodes.length - 1];

  if (
    previous?.type === "text" &&
    previous.bold === bold &&
    previous.italic === italic
  ) {
    nodes[nodes.length - 1] = { ...previous, value: previous.value + value };
    return;
  }

  nodes.push({ type: "text", value, bold, italic });
}

function parse(
  text: string,
  bold: boolean,
  italic: boolean,
  nodes: InlineNode[],
): void {
  let cursor = 0;

  for (const match of text.matchAll(TOKEN)) {
    const index = match.index ?? 0;

    pushText(nodes, text.slice(cursor, index), bold, italic);

    const [whole, linkLabel, linkHref, boldText, italicPrefix, italicText] =
      match;

    if (linkLabel !== undefined && linkHref !== undefined) {
      nodes.push({ type: "link", label: linkLabel, href: linkHref });
    } else if (boldText !== undefined) {
      parse(boldText, true, italic, nodes);
    } else if (italicText !== undefined) {
      pushText(nodes, italicPrefix ?? "", bold, italic);
      parse(italicText, bold, true, nodes);
    } else {
      pushText(nodes, whole, bold, italic);
    }

    cursor = index + whole.length;
  }

  pushText(nodes, text.slice(cursor), bold, italic);
}

/** Text on the same line right before / after the image (spaces allowed). */
function isInlineImage(text: string, start: number, end: number): boolean {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = text.indexOf("\n", end);
  const before = text.slice(lineStart, start);
  const after = text.slice(end, lineEnd < 0 ? text.length : lineEnd);
  const hasText = (value: string) => value.replace(IMAGE, "").trim().length > 0;

  return hasText(before) || hasText(after);
}

export function parseInlineMarkdown(text: string, images?: InlineImageMap): InlineNode[] {
  const nodes: InlineNode[] = [];

  if (!images) {
    parse(removeMarkdownImages(text), false, false, nodes);
    return nodes;
  }

  let cursor = 0;

  for (const match of text.matchAll(IMAGE_PARTS)) {
    const index = match.index ?? 0;
    const source = match[2] ?? "";
    const src = Object.hasOwn(images, source) ? images[source] : undefined;

    parse(text.slice(cursor, index), false, false, nodes);

    // Images without a local copy are dropped, as without a map.
    if (src) {
      nodes.push({
        type: "image",
        src,
        alt: match[1] ?? "",
        inline: isInlineImage(text, index, index + match[0].length),
      });
    }

    cursor = index + match[0].length;
  }

  parse(text.slice(cursor), false, false, nodes);

  return nodes;
}

/** Source URLs of the images a text references. */
export function markdownImageSources(text: string): string[] {
  return [...text.matchAll(IMAGE_PARTS)].map((match) => match[2] ?? "");
}

/** Plain text without markers, for previews and search snippets. */
export function stripInlineMarkdown(text: string): string {
  return parseInlineMarkdown(text)
    .map((node) => (node.type === "link" ? node.label : node.type === "text" ? node.value : ""))
    .join("");
}

/** True when the text shows something: words, or an image with a local copy. */
export function hasVisibleContent(text: string, images?: InlineImageMap): boolean {
  return (
    removeMarkdownImages(text).length > 0 ||
    (images !== undefined && markdownImageSources(text).some((source) => Object.hasOwn(images, source)))
  );
}
