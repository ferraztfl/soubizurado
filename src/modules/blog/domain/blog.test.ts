import { describe, expect, it } from "vitest";

import { excerptOf, isPostVisible, parseArticleBlocks, planPost, readingMinutes, toSaoPauloInput, type PostInput } from "./blog";

describe("parseArticleBlocks", () => {
  it("reads the article subset", () => {
    const body = [
      "## Edital publicado",
      "O edital saiu com **500 vagas**.",
      "- Soldado\n- Oficial",
      "1. Inscrição\n2. Prova",
      "> Atenção ao prazo",
      "[imagem 1]",
      "### Salários\nlinha 2 do parágrafo",
    ].join("\n\n");

    expect(parseArticleBlocks(body)).toEqual([
      { type: "heading", level: 2, text: "Edital publicado" },
      { type: "paragraph", text: "O edital saiu com **500 vagas**." },
      { type: "list", ordered: false, items: ["Soldado", "Oficial"] },
      { type: "list", ordered: true, items: ["Inscrição", "Prova"] },
      { type: "quote", text: "Atenção ao prazo" },
      { type: "image", index: 1 },
      { type: "paragraph", text: "### Salários\nlinha 2 do parágrafo" },
    ]);
  });

  it("never produces HTML: tags stay as paragraph text", () => {
    expect(parseArticleBlocks("<script>alert(1)</script>")).toEqual([{ type: "paragraph", text: "<script>alert(1)</script>" }]);
  });
});

describe("text helpers", () => {
  it("excerpt and reading time", () => {
    const body = "## Título\n\nTexto **forte** com [link](https://x.y) e mais palavras aqui.";
    expect(excerptOf(body)).toBe("Título Texto forte com link e mais palavras aqui.");
    expect(excerptOf("palavra ".repeat(100), 30).length).toBeLessThanOrEqual(30);
    expect(readingMinutes("palavra ".repeat(600))).toBe(3);
  });
});

const base: PostInput = {
  title: "Edital PMPE 2027 publicado",
  slug: "",
  excerpt: "",
  body: "O edital da PMPE 2027 foi publicado com muitas vagas.",
  status: "PUBLISHED",
  publishAt: "",
  categoryName: "Editais",
};
const now = new Date("2026-09-29T12:00:00Z");

describe("planPost", () => {
  it("publishes now, or at the scheduled São Paulo time", () => {
    expect(planPost(base, now)).toMatchObject({
      ok: true,
      post: { slug: "edital-pmpe-2027-publicado", status: "PUBLISHED", publishedAt: now, category: { slug: "editais" } },
    });
    expect(planPost({ ...base, publishAt: "2026-10-01T08:00" }, now)).toMatchObject({
      ok: true,
      post: { publishedAt: new Date("2026-10-01T11:00:00Z") },
    });
    expect(planPost({ ...base, status: "DRAFT" }, now)).toMatchObject({ ok: true, post: { publishedAt: null } });
  });

  it("rejects invalid posts", () => {
    expect(planPost({ ...base, title: "Oi" }, now)).toEqual({ ok: false, error: "TITLE_REQUIRED" });
    expect(planPost({ ...base, body: "curto" }, now)).toEqual({ ok: false, error: "BODY_REQUIRED" });
    expect(planPost({ ...base, publishAt: "amanhã" }, now)).toEqual({ ok: false, error: "DATE_INVALID" });
  });
});

describe("visibility and dates", () => {
  it("scheduled posts appear only at their time", () => {
    expect(isPostVisible("PUBLISHED", new Date("2026-09-29T11:00:00Z"), now)).toBe(true);
    expect(isPostVisible("PUBLISHED", new Date("2026-09-30T11:00:00Z"), now)).toBe(false);
    expect(isPostVisible("DRAFT", new Date("2026-09-01T11:00:00Z"), now)).toBe(false);
  });

  it("round-trips the datetime-local value", () => {
    expect(toSaoPauloInput(new Date("2026-10-01T11:00:00Z"))).toBe("2026-10-01T08:00");
  });
});
