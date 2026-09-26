/*
 * Minimal, safe inline Markdown for imported question texts.
 *
 * Supported: **bold**, _italic_ (word-delimited, so snake_case and URLs
 * are untouched), [label](http(s) link). Markdown images are removed:
 * every imported image with a local copy is already rendered by the
 * question media component, and remote images must not be hot-linked.
 *
 * Produces plain data; rendering creates React elements, never HTML
 * strings, so imported text cannot inject markup.
 */

export type InlineNode =
  | Readonly<{ type: "text"; value: string; bold: boolean; italic: boolean }>
  | Readonly<{ type: "link"; label: string; href: string }>;

const IMAGE = /!\[[^\]\n]*\]\([^)\s]*\)/g;

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
  value: string,
  bold: boolean,
  italic: boolean,
): void {
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

export function parseInlineMarkdown(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];

  parse(removeMarkdownImages(text), false, false, nodes);

  return nodes;
}

/** Plain text without markers, for previews and search snippets. */
export function stripInlineMarkdown(text: string): string {
  return parseInlineMarkdown(text)
    .map((node) => (node.type === "link" ? node.label : node.value))
    .join("");
}
