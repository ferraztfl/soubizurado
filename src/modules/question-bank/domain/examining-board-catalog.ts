/*
 * Canonical examining boards (bancas). The name is what students see in
 * filters; the slug is derived from it and is the stable identity used
 * by importers. Boards with similar names are distinct entities:
 * "Instituto AOCP" and "AOCP" are different boards.
 *
 * `detect` patterns suggest a board from the text printed on a booklet;
 * the administrator always confirms the suggestion.
 */

export type ExaminingBoardCatalogEntry = Readonly<{
  name: string;
  acronym: string;
  websiteUrl: string | null;
  detect: readonly RegExp[];
}>;

export const EXAMINING_BOARD_CATALOG: readonly ExaminingBoardCatalogEntry[] = [
  {
    name: "Instituto AOCP",
    acronym: "Instituto AOCP",
    websiteUrl: "https://www.institutoaocp.org.br",
    detect: [/instituto\s+aocp/i, /institutoaocp\.org/i],
  },
  {
    name: "AOCP",
    acronym: "AOCP",
    websiteUrl: null,
    // Plain "AOCP" only when "Instituto" does not precede it.
    detect: [/(?<!instituto\s{1,3})(?<![a-z])aocp(?![a-z])(?!\.org)/i],
  },
  {
    name: "Cebraspe",
    acronym: "Cebraspe",
    websiteUrl: "https://www.cebraspe.org.br",
    detect: [/cebraspe/i],
  },
  {
    name: "Fundatec",
    acronym: "Fundatec",
    websiteUrl: "https://www.fundatec.org.br",
    detect: [/fundatec/i],
  },
  {
    name: "FGV",
    acronym: "FGV",
    websiteUrl: "https://conhecimento.fgv.br",
    detect: [/funda[cç][aã]o\s+get[uú]lio\s+vargas/i, /conhecimento\.fgv\.br/i],
  },
  {
    name: "VUNESP",
    acronym: "VUNESP",
    websiteUrl: "https://www.vunesp.com.br",
    detect: [/vunesp/i],
  },
  {
    name: "FCC",
    acronym: "FCC",
    websiteUrl: "https://www.concursosfcc.com.br",
    detect: [/funda[cç][aã]o\s+carlos\s+chagas/i, /concursosfcc/i],
  },
  {
    name: "IBFC",
    acronym: "IBFC",
    websiteUrl: "https://www.ibfc.org.br",
    detect: [/\bibfc\b/i],
  },
  {
    name: "Instituto Consulplan",
    acronym: "Instituto Consulplan",
    websiteUrl: "https://www.institutoconsulplan.org.br",
    detect: [/instituto\s+consulplan/i, /institutoconsulplan/i],
  },
  {
    name: "IDECAN",
    acronym: "IDECAN",
    websiteUrl: "https://www.idecan.org.br",
    detect: [/\bidecan\b/i],
  },
  {
    name: "IADES",
    acronym: "IADES",
    websiteUrl: "https://www.iades.com.br",
    detect: [/\biades\b/i],
  },
  {
    name: "Instituto Quadrix",
    acronym: "Quadrix",
    websiteUrl: "https://www.quadrix.org.br",
    detect: [/quadrix/i],
  },
  {
    name: "Cesgranrio",
    acronym: "Cesgranrio",
    websiteUrl: "https://www.cesgranrio.org.br",
    detect: [/cesgranrio/i],
  },
  {
    name: "IBADE",
    acronym: "IBADE",
    websiteUrl: "https://www.ibade.org.br",
    detect: [/\bibade\b/i],
  },
  {
    name: "Consulplan",
    acronym: "Consulplan",
    websiteUrl: null,
    detect: [/(?<!instituto\s{1,3})consulplan(?!\.org)/i],
  },
  {
    name: "FUNRIO",
    acronym: "FUNRIO",
    websiteUrl: null,
    detect: [/\bfunrio\b/i],
  },
  {
    name: "FEPESE",
    acronym: "FEPESE",
    websiteUrl: null,
    detect: [/\bfepese\b/i],
  },
  {
    name: "FAURGS",
    acronym: "FAURGS",
    websiteUrl: null,
    detect: [/\bfaurgs\b/i],
  },
  {
    name: "FUMARC",
    acronym: "FUMARC",
    websiteUrl: null,
    detect: [/\bfumarc\b/i],
  },
  {
    name: "Objetiva Concursos",
    acronym: "Objetiva",
    websiteUrl: null,
    detect: [/objetiva\s+concursos/i],
  },
  {
    name: "Instituto Selecon",
    acronym: "Selecon",
    websiteUrl: null,
    detect: [/\bselecon\b/i],
  },
  {
    name: "IDIB",
    acronym: "IDIB",
    websiteUrl: null,
    detect: [/\bidib\b/i],
  },
  {
    name: "IBAM",
    acronym: "IBAM",
    websiteUrl: null,
    detect: [/\bibam\b/i],
  },
  {
    name: "IBGP",
    acronym: "IBGP",
    websiteUrl: null,
    detect: [/\bibgp\b/i],
  },
  {
    name: "IESES",
    acronym: "IESES",
    websiteUrl: null,
    detect: [/\bieses\b/i],
  },
  {
    name: "Fundação La Salle",
    acronym: "La Salle",
    websiteUrl: null,
    detect: [/funda[cç][aã]o\s+la\s+salle/i],
  },
  {
    name: "FUNDEP",
    acronym: "FUNDEP",
    websiteUrl: null,
    detect: [/\bfundep\b/i],
  },
  {
    name: "FADESP",
    acronym: "FADESP",
    websiteUrl: null,
    detect: [/\bfadesp\b/i],
  },
  {
    name: "NC-UFPR",
    acronym: "NC-UFPR",
    websiteUrl: null,
    detect: [/\bnc[\s-]?ufpr\b/i, /n[uú]cleo\s+de\s+concursos[\s\S]{0,40}paran[aá]/i],
  },
  {
    name: "COPEVE-UFAL",
    acronym: "COPEVE-UFAL",
    websiteUrl: null,
    detect: [/\bcopeve\b/i],
  },
  {
    name: "COMPERVE-UFRN",
    acronym: "COMPERVE",
    websiteUrl: null,
    detect: [/\bcomperve\b/i],
  },
  {
    name: "Instituto Verbena",
    acronym: "Verbena",
    websiteUrl: null,
    detect: [/instituto\s+verbena/i],
  },
  {
    name: "Instituto Access",
    acronym: "Access",
    websiteUrl: null,
    detect: [/instituto\s+access/i],
  },
  {
    name: "CETRO",
    acronym: "CETRO",
    websiteUrl: null,
    detect: [/\bcetro\s+concursos\b/i],
  },
  {
    name: "ESAF",
    acronym: "ESAF",
    websiteUrl: null,
    detect: [/\besaf\b/i],
  },
  {
    name: "FUNIVERSA",
    acronym: "FUNIVERSA",
    websiteUrl: null,
    detect: [/\bfuniversa\b/i],
  },
  {
    name: "ACAFE",
    acronym: "ACAFE",
    websiteUrl: null,
    detect: [/\bacafe\b/i],
  },
  {
    name: "Legalle Concursos",
    acronym: "Legalle",
    websiteUrl: null,
    detect: [/\blegalle\b/i],
  },
  {
    name: "Instituto Mais",
    acronym: "Instituto Mais",
    websiteUrl: null,
    detect: [/instituto\s+mais\b/i],
  },
  {
    name: "INEP",
    acronym: "INEP",
    websiteUrl: "https://www.gov.br/inep",
    detect: [/\binep\b/i, /exame\s+nacional\s+do\s+ensino\s+m[eé]dio/i],
  },
];

/** Same rule the import repository uses for board slugs. */
export function examiningBoardSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

/**
 * First catalog board whose pattern appears in the text, in catalog
 * order (more specific names first). Null when nothing matches.
 */
export function suggestExaminingBoard(text: string): ExaminingBoardCatalogEntry | null {
  return EXAMINING_BOARD_CATALOG.find((entry) => entry.detect.some((pattern) => pattern.test(text))) ?? null;
}
