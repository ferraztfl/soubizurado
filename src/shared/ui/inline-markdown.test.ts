import { describe, expect, it } from "vitest";

import {
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
