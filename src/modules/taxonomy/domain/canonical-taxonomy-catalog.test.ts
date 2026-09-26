import { describe, expect, it } from "vitest";

import {
  type CanonicalTaxonomyCatalog,
  countCatalog,
  validateCanonicalTaxonomyCatalog,
} from "./canonical-taxonomy-catalog";

function catalogWith(
  overrides: Partial<CanonicalTaxonomyCatalog> = {},
): CanonicalTaxonomyCatalog {
  return {
    version: 1,
    summary: "test",
    knowledgeAreas: [
      {
        slug: "matematica-e-suas-tecnologias",
        name: "Matemática e suas Tecnologias",
      },
    ],
    disciplines: [
      {
        name: "Matemática",
        knowledgeAreaSlug: "matematica-e-suas-tecnologias",
        areas: [
          {
            name: "Álgebra",
            topics: [
              {
                name: "Funções",
                subtopics: [
                  {
                    name: "Função Afim",
                    aliases: ["Função do 1º grau"],
                  },
                  { name: "Função Quadrática" },
                ],
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("validateCanonicalTaxonomyCatalog", () => {
  it("accepts a consistent catalog", () => {
    expect(
      validateCanonicalTaxonomyCatalog(catalogWith()),
    ).toEqual([]);
  });

  it("rejects an alias that duplicates a canonical name in the same scope", () => {
    const catalog = catalogWith({
      disciplines: [
        {
          name: "Matemática",
          knowledgeAreaSlug: null,
          areas: [
            {
              name: "Álgebra",
              topics: [
                {
                  name: "Funções",
                  subtopics: [
                    { name: "Função Afim" },
                    {
                      name: "Função Linear",
                      aliases: ["funcao afim"],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(
      validateCanonicalTaxonomyCatalog(catalog),
    ).toEqual([
      expect.stringContaining(
        '"funcao afim" is used by both subtopic "Função Afim" and subtopic "Função Linear"',
      ),
    ]);
  });

  it("treats topics as unique per discipline across areas", () => {
    const catalog = catalogWith({
      disciplines: [
        {
          name: "Matemática",
          knowledgeAreaSlug: null,
          areas: [
            {
              name: "Álgebra",
              topics: [{ name: "Razão e Proporção" }],
            },
            {
              name: "Aritmética",
              topics: [{ name: "Razao e proporcao" }],
            },
          ],
        },
      ],
    });

    expect(
      validateCanonicalTaxonomyCatalog(catalog),
    ).toHaveLength(1);
  });

  it("allows the same subtopic name under different topics", () => {
    const catalog = catalogWith({
      disciplines: [
        {
          name: "Física",
          knowledgeAreaSlug: null,
          areas: [
            {
              name: "Mecânica",
              topics: [
                {
                  name: "Cinemática",
                  subtopics: [{ name: "Conceitos básicos" }],
                },
                {
                  name: "Dinâmica",
                  subtopics: [{ name: "Conceitos básicos" }],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(
      validateCanonicalTaxonomyCatalog(catalog),
    ).toEqual([]);
  });

  it("rejects unknown knowledge areas and empty branches", () => {
    const catalog = catalogWith({
      disciplines: [
        {
          name: "História",
          knowledgeAreaSlug: "inexistente",
          areas: [{ name: "Brasil", topics: [] }],
        },
      ],
    });

    const issues =
      validateCanonicalTaxonomyCatalog(catalog);

    expect(issues).toContainEqual(
      expect.stringContaining('unknown knowledge area "inexistente"'),
    );
    expect(issues).toContainEqual(
      expect.stringContaining("has no topics"),
    );
  });

  it("rejects duplicated discipline aliases across disciplines", () => {
    const catalog = catalogWith({
      disciplines: [
        {
          name: "Língua Portuguesa",
          aliases: ["Português"],
          knowledgeAreaSlug: null,
          areas: [{ name: "Gramática", topics: [{ name: "Morfologia" }] }],
        },
        {
          name: "Literatura",
          aliases: ["portugues"],
          knowledgeAreaSlug: null,
          areas: [{ name: "Escolas", topics: [{ name: "Barroco" }] }],
        },
      ],
    });

    expect(
      validateCanonicalTaxonomyCatalog(catalog),
    ).toHaveLength(1);
  });
});

describe("countCatalog", () => {
  it("counts every level and alias", () => {
    expect(countCatalog(catalogWith())).toEqual({
      knowledgeAreas: 1,
      disciplines: 1,
      areas: 1,
      topics: 1,
      subtopics: 2,
      aliases: 1,
    });
  });
});
