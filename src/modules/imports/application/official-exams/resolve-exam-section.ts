import { normalizeTaxonomyTerm } from "@/modules/taxonomy/domain/taxonomy-term";

/** A canonical discipline with its normalized name and aliases. */
export type SectionTaxonomyEntry = Readonly<{
  disciplineName: string;
  knowledgeAreaSlug: string;
  terms: readonly string[];
}>;

export type SectionResolution =
  | Readonly<{
      kind: "DISCIPLINE";
      disciplineName: string;
      knowledgeAreaSlug: string;
    }>
  | Readonly<{
      kind: "KNOWLEDGE_AREA";
      knowledgeAreaSlug: string;
    }>
  | Readonly<{ kind: "UNRESOLVED" }>;

/** Minimum length for a term matched inside a longer section name. */
const MIN_CONTAINED_TERM_LENGTH = 5;

/**
 * Area-level fallbacks for sections that name a field, not a single
 * discipline (e.g. "Noções de Direito", "Legislação Aplicada").
 */
const KNOWLEDGE_AREA_RULES: readonly Readonly<{
  pattern: RegExp;
  knowledgeAreaSlug: string;
}>[] = [
  { pattern: /\b(direito|direitos|legislacao|juridic\w*|penal|constitucional)\b/, knowledgeAreaSlug: "ciencias-juridicas" },
  { pattern: /\b(informatica|computacao|tecnologia da informacao)\b/, knowledgeAreaSlug: "tecnologia-da-informacao" },
];

function contains(haystack: string, needle: string): boolean {
  return ` ${haystack} `.includes(` ${needle} `);
}

/**
 * Maps an exam board section heading to the canonical taxonomy.
 * Never invents entries: anything ambiguous is UNRESOLVED and must be
 * mapped by a reviewer before import.
 */
export function resolveExamSection(
  section: string | null,
  entries: readonly SectionTaxonomyEntry[],
): SectionResolution {
  const normalized = section ? normalizeTaxonomyTerm(section) : "";

  if (!normalized) {
    return { kind: "UNRESOLVED" };
  }

  const exact = entries.find((entry) => entry.terms.includes(normalized));

  if (exact) {
    return {
      kind: "DISCIPLINE",
      disciplineName: exact.disciplineName,
      knowledgeAreaSlug: exact.knowledgeAreaSlug,
    };
  }

  const matches = entries
    .map((entry) => ({
      entry,
      term: [...entry.terms]
        .filter((term) => term.length >= MIN_CONTAINED_TERM_LENGTH && contains(normalized, term))
        .sort((a, b) => b.length - a.length)[0],
    }))
    .filter((match): match is { entry: SectionTaxonomyEntry; term: string } => Boolean(match.term));

  // Drop matches whose term is part of a longer matched term
  // ("direito penal" inside "direito penal militar").
  const specific = matches.filter(
    (match) =>
      !matches.some(
        (other) =>
          other !== match &&
          other.term.length > match.term.length &&
          contains(other.term, match.term),
      ),
  );

  const disciplines = [...new Map(specific.map((match) => [match.entry.disciplineName, match.entry])).values()];

  if (disciplines.length === 1) {
    return {
      kind: "DISCIPLINE",
      disciplineName: disciplines[0]!.disciplineName,
      knowledgeAreaSlug: disciplines[0]!.knowledgeAreaSlug,
    };
  }

  if (disciplines.length > 1) {
    const areas = new Set(disciplines.map((entry) => entry.knowledgeAreaSlug));

    return areas.size === 1
      ? { kind: "KNOWLEDGE_AREA", knowledgeAreaSlug: [...areas][0]! }
      : { kind: "UNRESOLVED" };
  }

  const rule = KNOWLEDGE_AREA_RULES.find((candidate) => candidate.pattern.test(normalized));

  return rule
    ? { kind: "KNOWLEDGE_AREA", knowledgeAreaSlug: rule.knowledgeAreaSlug }
    : { kind: "UNRESOLVED" };
}
