/*
 * High-precision rules for concurso questions: explicit references to a
 * law number, a named statute or an article of the Constitution point to
 * one Subtópico almost unambiguously. Targets are names that exist in
 * the canonical taxonomy (see concursos-taxonomy-additions.ts); a target
 * that is missing or outside the question Matéria is simply ignored.
 *
 * PDF text often reads "Lei no 11.340/2006" (o instead of º), so the
 * law-number pattern accepts nº, n°, no, n.º, n. or nothing.
 */

export type LegalTarget = Readonly<{
  discipline: string;
  topic: string;
}>;

export type LegalReferenceHit = LegalTarget &
  Readonly<{
    evidence: string;
    /** Law numbers and named statutes weigh more than article ranges. */
    weight: number;
  }>;

const LEGISLACAO = "Legislação Penal Especial";
const ADMINISTRATIVO = "Direito Administrativo";
const PENAL = "Direito Penal";
const CONSTITUCIONAL = "Direito Constitucional";

/** Law number (digits only) → Subtópico. */
const LAWS: Readonly<Record<string, LegalTarget>> = {
  "11340": { discipline: LEGISLACAO, topic: "Lei Maria da Penha" },
  "8072": { discipline: LEGISLACAO, topic: "Crimes Hediondos" },
  "7210": { discipline: LEGISLACAO, topic: "Lei de Execução Penal" },
  "11343": { discipline: LEGISLACAO, topic: "Lei de Drogas" },
  "10826": { discipline: LEGISLACAO, topic: "Estatuto do Desarmamento" },
  "13869": { discipline: LEGISLACAO, topic: "Abuso de Autoridade" },
  "4898": { discipline: LEGISLACAO, topic: "Abuso de Autoridade" },
  "9455": { discipline: LEGISLACAO, topic: "Lei de Tortura" },
  "12850": { discipline: LEGISLACAO, topic: "Organizações Criminosas" },
  "9613": { discipline: LEGISLACAO, topic: "Lavagem de Dinheiro" },
  "9605": { discipline: LEGISLACAO, topic: "Crimes Ambientais" },
  "9296": { discipline: LEGISLACAO, topic: "Interceptação Telefônica" },
  "9099": { discipline: LEGISLACAO, topic: "Juizados Especiais Criminais" },
  "7716": { discipline: LEGISLACAO, topic: "Crimes de Racismo" },
  "8069": { discipline: LEGISLACAO, topic: "Estatuto da Criança e do Adolescente" },
  "10741": { discipline: LEGISLACAO, topic: "Estatuto da Pessoa Idosa" },
  "13146": { discipline: LEGISLACAO, topic: "Estatuto da Pessoa com Deficiência" },
  "8112": { discipline: ADMINISTRATIVO, topic: "Regime Jurídico dos Servidores" },
  "8429": { discipline: ADMINISTRATIVO, topic: "Improbidade Administrativa" },
  "14230": { discipline: ADMINISTRATIVO, topic: "Improbidade Administrativa" },
  "14133": { discipline: ADMINISTRATIVO, topic: "Licitações" },
  "8666": { discipline: ADMINISTRATIVO, topic: "Licitações" },
  "10520": { discipline: ADMINISTRATIVO, topic: "Licitações" },
  "9784": { discipline: ADMINISTRATIVO, topic: "Processo Administrativo" },
};

/** Statutes cited by name. */
const NAMED: readonly Readonly<{ pattern: RegExp; target: LegalTarget }>[] = [
  { pattern: /lei\s+maria\s+da\s+penha/i, target: LAWS["11340"]! },
  { pattern: /lei\s+(?:dos\s+)?crimes\s+hediondos/i, target: LAWS["8072"]! },
  { pattern: /lei\s+de\s+execu[cç][aã]o\s+penal|\blep\b/i, target: LAWS["7210"]! },
  { pattern: /lei\s+(?:de|antidrogas|sobre)\s*drogas|lei\s+antidrogas/i, target: LAWS["11343"]! },
  { pattern: /estatuto\s+do\s+desarmamento/i, target: LAWS["10826"]! },
  { pattern: /lei\s+de\s+abuso\s+de\s+autoridade/i, target: LAWS["13869"]! },
  { pattern: /lei\s+(?:de|contra\s+a)\s+tortura/i, target: LAWS["9455"]! },
  { pattern: /estatuto\s+da\s+crian[cç]a\s+e\s+do\s+adolescente|\beca\b/i, target: LAWS["8069"]! },
  { pattern: /estatuto\s+(?:do\s+idoso|da\s+pessoa\s+idosa)/i, target: LAWS["10741"]! },
  { pattern: /lei\s+de\s+improbidade/i, target: LAWS["8429"]! },
  { pattern: /lei\s+de\s+licita[cç][oõ]es/i, target: LAWS["14133"]! },
  // State statutes are matched by name only: state law numbers repeat
  // across states.
  {
    pattern: /estatuto\s+dos\s+militares\s+(?:do\s+estado\s+)?de\s+pernambuco/i,
    target: { discipline: "Legislação Institucional", topic: "Estatutos dos Militares Estaduais" },
  },
];

/** Constitution article ranges → Subtópico (inclusive). */
const CONSTITUTION_ARTICLES: readonly Readonly<{ from: number; to: number; topic: string }>[] = [
  { from: 1, to: 4, topic: "Princípios Fundamentais" },
  { from: 5, to: 5, topic: "Direitos e Deveres Individuais e Coletivos" },
  { from: 6, to: 11, topic: "Direitos Sociais" },
  { from: 12, to: 13, topic: "Nacionalidade" },
  { from: 14, to: 16, topic: "Direitos Políticos" },
  { from: 18, to: 19, topic: "Organização Político-Administrativa" },
  { from: 21, to: 24, topic: "Competências da União, Estados e Municípios" },
  { from: 34, to: 36, topic: "Intervenção Federal e Estadual" },
  { from: 37, to: 38, topic: "Disposições Gerais da Administração Pública" },
  { from: 39, to: 41, topic: "Servidores Públicos na Constituição" },
  { from: 136, to: 141, topic: "Estado de Defesa e Estado de Sítio" },
  { from: 142, to: 143, topic: "Forças Armadas" },
  { from: 144, to: 144, topic: "Segurança Pública" },
  { from: 225, to: 225, topic: "Meio Ambiente na Constituição" },
  { from: 226, to: 230, topic: "Família, Criança, Adolescente e Idoso" },
  { from: 231, to: 232, topic: "Povos Indígenas na Constituição" },
];

/** Código Penal article ranges → Subtópico (inclusive). */
const PENAL_CODE_ARTICLES: readonly Readonly<{ from: number; to: number; topic: string }>[] = [
  { from: 1, to: 12, topic: "Aplicação da Lei Penal" },
  { from: 13, to: 28, topic: "Teoria do Crime" },
  { from: 29, to: 31, topic: "Concurso de Pessoas" },
  { from: 32, to: 106, topic: "Penas" },
  { from: 107, to: 120, topic: "Extinção da Punibilidade" },
  { from: 121, to: 154, topic: "Crimes contra a Pessoa" },
  { from: 155, to: 183, topic: "Crimes contra o Patrimônio" },
  { from: 213, to: 234, topic: "Crimes contra a Dignidade Sexual" },
  { from: 286, to: 288, topic: "Crimes contra a Paz Pública" },
  { from: 289, to: 311, topic: "Crimes contra a Fé Pública" },
  { from: 312, to: 359, topic: "Crimes contra a Administração Pública" },
];

const LAW_NUMBER =
  /\blei(?:\s+complementar|\s+federal)?\s*(?:n\s*[º°o]?\s*\.?\s*[º°]?)?\s*(\d{1,2}\.?\d{3})\b/gi;

const CONSTITUTION = /constitui[cç][aã]o\s+(?:federal|da\s+rep[uú]blica)|\bcf(?:\/88)?\b|\bcrfb\b/i;

const PENAL_CODE = /c[oó]digo\s+penal(?!\s+militar)|\bcp\b/i;

const ARTICLE = /\bart(?:igo)?s?\.?\s*(\d{1,3})\s*[º°o]?(?!\d)/gi;

function articleHits(
  text: string,
  ranges: readonly Readonly<{ from: number; to: number; topic: string }>[],
  discipline: string,
): LegalReferenceHit[] {
  const hits: LegalReferenceHit[] = [];

  for (const match of text.matchAll(ARTICLE)) {
    const article = Number(match[1]);
    const range = ranges.find((entry) => article >= entry.from && article <= entry.to);

    if (range) {
      hits.push({ discipline, topic: range.topic, evidence: match[0].trim(), weight: 2 });
    }
  }

  return hits;
}

export function matchLegalReferences(text: string): LegalReferenceHit[] {
  const hits: LegalReferenceHit[] = [];

  for (const match of text.matchAll(LAW_NUMBER)) {
    const target = LAWS[match[1]!.replace(".", "")];

    if (target) {
      hits.push({ ...target, evidence: match[0].trim(), weight: 3 });
    }
  }

  for (const { pattern, target } of NAMED) {
    const match = text.match(pattern);

    if (match) {
      hits.push({ ...target, evidence: match[0].trim(), weight: 3 });
    }
  }

  // Articles only count when no specific law is cited (an "art. 5º" of
  // Lei 11.340 is not the CF) and exactly one code is mentioned.
  if (hits.length === 0) {
    const aboutConstitution = CONSTITUTION.test(text);
    const aboutPenalCode = PENAL_CODE.test(text);

    if (aboutConstitution && !aboutPenalCode) {
      hits.push(...articleHits(text, CONSTITUTION_ARTICLES, CONSTITUCIONAL));
    } else if (aboutPenalCode && !aboutConstitution) {
      hits.push(...articleHits(text, PENAL_CODE_ARTICLES, PENAL));
    }
  }

  return hits;
}
