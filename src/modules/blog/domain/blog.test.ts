import { describe, expect, it } from "vitest";

import {
  articlePlainText,
  excerptOf,
  isPostVisible,
  parseArticleBlocks,
  parseStateCode,
  planPost,
  readingMinutes,
  relativePublishedAt,
  toSaoPauloInput,
  type PostInput,
} from "./blog";

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

  it("reads callouts and tables", () => {
    const body = [
      "!!! resumo Concurso PMPE em resumo\n- **Vagas:** 1.320\nSituação: autorizado",
      "!!! chamada Consulte o edital\nO último edital é a melhor referência.\n[Baixar o edital](https://www.pe.gov.br/edital.pdf)\n[Link inseguro](http://x.y)",
      "!!! atenção Previsão não é cronograma\nAs datas são estimativas.",
      "| Cargo | Vagas |\n|---|---|\n| Soldado | 1.250 |\n| Oficial | 70 | extra |",
    ].join("\n\n");

    expect(parseArticleBlocks(body)).toEqual([
      {
        type: "callout",
        kind: "resumo",
        title: "Concurso PMPE em resumo",
        lines: [
          { type: "item", text: "**Vagas:** 1.320" },
          { type: "text", text: "Situação: autorizado" },
        ],
      },
      {
        type: "callout",
        kind: "chamada",
        title: "Consulte o edital",
        lines: [
          { type: "text", text: "O último edital é a melhor referência." },
          { type: "button", label: "Baixar o edital", href: "https://www.pe.gov.br/edital.pdf" },
          { type: "text", text: "[Link inseguro](http://x.y)" },
        ],
      },
      { type: "callout", kind: "atencao", title: "Previsão não é cronograma", lines: [{ type: "text", text: "As datas são estimativas." }] },
      {
        type: "table",
        header: ["Cargo", "Vagas"],
        rows: [
          ["Soldado", "1.250"],
          ["Oficial", "70"],
        ],
      },
    ]);
    expect(articlePlainText(body)).not.toMatch(/!!!|\||---/);
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

describe("portal helpers", () => {
  it("relative time in Portuguese", () => {
    const at = new Date("2026-09-29T12:00:00Z");
    expect(relativePublishedAt(new Date("2026-09-29T11:59:30Z"), at)).toBe("Agora mesmo");
    expect(relativePublishedAt(new Date("2026-09-29T11:01:00Z"), at)).toBe("Há 59 minutos");
    expect(relativePublishedAt(new Date("2026-09-29T10:30:00Z"), at)).toBe("Há uma hora");
    expect(relativePublishedAt(new Date("2026-09-29T09:00:00Z"), at)).toBe("Há 3 horas");
    expect(relativePublishedAt(new Date("2026-09-24T15:00:00Z"), at)).toBe("24 de setembro");
  });

  it("states and new post fields", () => {
    expect(parseStateCode("pe")).toBe("PE");
    expect(parseStateCode("XX")).toBeNull();
    expect(planPost({ ...base, format: "ARTICLE", stateCode: "pe", isFeatured: true }, now)).toMatchObject({
      ok: true,
      post: { format: "ARTICLE", stateCode: "PE", isFeatured: true },
    });
  });
});
