import { describe, expect, it } from "vitest";

import {
  hasVisibleContent,
  parseInlineMarkdown,
  removeMarkdownImages,
  stripInlineMarkdown,
} from "./inline-markdown";

const text = (value: string, bold = false, italic = false) => ({
  type: "text",
  value,
  bold,
  italic,
});

describe("parseInlineMarkdown", () => {
  it("keeps plain text untouched", () => {
    expect(parseInlineMarkdown("Leia o texto a seguir.")).toEqual([
      text("Leia o texto a seguir."),
    ]);
  });

  it("parses bold and word-delimited italic", () => {
    expect(
      parseInlineMarkdown("**Dengue**: vírus do gênero _Flavivírus_, transmitido."),
    ).toEqual([
      text("Dengue", true),
      text(": vírus do gênero "),
      text("Flavivírus", false, true),
      text(", transmitido."),
    ]);
  });

  it("supports italic inside bold", () => {
    expect(parseInlineMarkdown("**Fonte: _Folha_ 2012**")).toEqual([
      text("Fonte: ", true),
      text("Folha", true, true),
      text(" 2012", true),
    ]);
  });

  it("does not treat snake_case, URLs or lone markers as formatting", () => {
    const value = "arquivo_final e http://site.com/a_b_c e 2 * 3 * 4 e **";
    expect(parseInlineMarkdown(value)).toEqual([text(value)]);
  });

  it("turns http(s) links into link nodes only", () => {
    expect(
      parseInlineMarkdown("Veja [planalto](http://www.planalto.gov.br/) e [x](javascript:alert(1))."),
    ).toEqual([
      text("Veja "),
      { type: "link", label: "planalto", href: "http://www.planalto.gov.br/" },
      text(" e [x](javascript:alert(1))."),
    ]);
  });

  it("removes markdown images and the blank lines they leave", () => {
    expect(
      parseInlineMarkdown("Observe.\n\n![](https://enem.dev/2013/q/1.png)\n\n\nQual a resposta?"),
    ).toEqual([text("Observe.\n\nQual a resposta?")]);
  });

  it("never emits HTML, even for markup-looking input", () => {
    expect(parseInlineMarkdown("<script>alert(1)</script>")).toEqual([
      text("<script>alert(1)</script>"),
    ]);
  });
});

describe("helpers", () => {
  it("strips markers for previews", () => {
    expect(stripInlineMarkdown("**A** _b_ [c](https://x.y) ![](https://z)")).toBe("A b c");
  });

  it("removes images without touching the rest", () => {
    expect(removeMarkdownImages("a ![alt](https://x/y.png) b")).toBe("a  b");
  });
});

describe("images with a local copy", () => {
  const images = { "https://src/n1.jpg": "/api/media/n1", "https://src/fig.jpg": "/api/media/fig" };

  it("renders mapped images where they are written, symbols inline", () => {
    expect(parseInlineMarkdown("S = 5 ![](https://src/n1.jpg)\+ 4", images)).toEqual([
      text("S = 5 "),
      { type: "image", src: "/api/media/n1", alt: "", inline: true },
      text("+ 4"),
    ]);
  });

  it("marks an image alone on its line as a figure", () => {
    expect(parseInlineMarkdown("Veja:\n![Gráfico](https://src/fig.jpg)\nFim", images)[1]).toEqual({
      type: "image",
      src: "/api/media/fig",
      alt: "Gráfico",
      inline: false,
    });
  });

  it("drops images without a local copy (never hot-links)", () => {
    expect(parseInlineMarkdown("a ![](https://elsewhere/x.png) b", images)).toEqual([text("a  b")]);
  });

  it("tells whether a text has anything to show", () => {
    expect(hasVisibleContent("![](https://src/fig.jpg)", images)).toBe(true);
    expect(hasVisibleContent("![](https://src/fig.jpg)")).toBe(false);
    expect(hasVisibleContent("![](https://elsewhere/x.png)", images)).toBe(false);
  });
});

describe("backslash escapes", () => {
  it("shows the escaped character", () => {
    expect(parseInlineMarkdown("PETRI, D. \[...\] 5 \+ 4 \* 2")).toEqual([text("PETRI, D. [...] 5 + 4 * 2")]);
  });
});
