/*
 * Moves questions from the legacy ENEM "disciplines" (which are really
 * knowledge areas) towards the canonical taxonomy, using only
 * deterministic signals. Anything that needs reading the question
 * content is left to the classifier.
 */

export const LEGACY_ENEM_KNOWLEDGE_AREA_SLUGS = [
  "linguagens-codigos-e-suas-tecnologias",
  "ciencias-humanas-e-suas-tecnologias",
  "ciencias-da-natureza-e-suas-tecnologias",
  "matematica-e-suas-tecnologias",
] as const;

export type LegacyKnowledgeAreaSlug =
  (typeof LEGACY_ENEM_KNOWLEDGE_AREA_SLUGS)[number];

/** Signal that decides whether a legacy question can move. */
export type DisciplineMoveSignal =
  | Readonly<{ kind: "ALL" }>
  | Readonly<{
      /** Every occurrence externalId ends with this suffix. */
      kind: "EXTERNAL_ID_SUFFIX";
      suffix: string;
    }>;

export type DisciplineMoveRuleDefinition = Readonly<{
  code: string;
  fromLegacySlug: LegacyKnowledgeAreaSlug;
  toDisciplineSlug: string;
  signal: DisciplineMoveSignal;
}>;

export const LEGACY_ENEM_DISCIPLINE_MOVE_RULES: readonly DisciplineMoveRuleDefinition[] = [
  {
    code: "MATEMATICA",
    fromLegacySlug: "matematica-e-suas-tecnologias",
    toDisciplineSlug: "matematica",
    signal: { kind: "ALL" },
  },
  {
    code: "LINGUA_INGLESA",
    fromLegacySlug: "linguagens-codigos-e-suas-tecnologias",
    toDisciplineSlug: "lingua-inglesa",
    signal: { kind: "EXTERNAL_ID_SUFFIX", suffix: "-ingles" },
  },
  {
    code: "LINGUA_ESPANHOLA",
    fromLegacySlug: "linguagens-codigos-e-suas-tecnologias",
    toDisciplineSlug: "lingua-espanhola",
    signal: { kind: "EXTERNAL_ID_SUFFIX", suffix: "-espanhol" },
  },
];

export type TaxonomyIdLookup = Readonly<{
  legacyDisciplineIdBySlug: ReadonlyMap<string, string>;
  knowledgeAreaIdBySlug: ReadonlyMap<string, string>;
  disciplineIdBySlug: ReadonlyMap<string, string>;
  knowledgeAreaIdByDisciplineSlug: ReadonlyMap<string, string | null>;
}>;

export type KnowledgeAreaFillRule = Readonly<{
  legacySlug: LegacyKnowledgeAreaSlug;
  legacyDisciplineId: string;
  knowledgeAreaId: string;
}>;

export type DisciplineMoveRule = Readonly<{
  code: string;
  legacyDisciplineId: string;
  targetDisciplineId: string;
  targetKnowledgeAreaId: string;
  signal: DisciplineMoveSignal;
}>;

export type LegacyBackfillRules = Readonly<{
  knowledgeAreaFills: readonly KnowledgeAreaFillRule[];
  disciplineMoves: readonly DisciplineMoveRule[];
  /** Missing taxonomy rows; the backfill must not run with any. */
  problems: readonly string[];
}>;

/**
 * Resolves slug-based rules to database ids. A missing legacy
 * discipline only skips its rules (nothing to migrate); a missing
 * canonical target is a problem because the seed has not run.
 */
export function resolveLegacyBackfillRules(
  lookup: TaxonomyIdLookup,
): LegacyBackfillRules {
  const problems: string[] = [];
  const knowledgeAreaFills: KnowledgeAreaFillRule[] = [];
  const disciplineMoves: DisciplineMoveRule[] = [];

  for (const legacySlug of LEGACY_ENEM_KNOWLEDGE_AREA_SLUGS) {
    const legacyDisciplineId =
      lookup.legacyDisciplineIdBySlug.get(legacySlug);
    const knowledgeAreaId =
      lookup.knowledgeAreaIdBySlug.get(legacySlug);

    if (!knowledgeAreaId) {
      problems.push(`Knowledge area "${legacySlug}" is missing; run taxonomy:seed first.`);
      continue;
    }

    if (legacyDisciplineId) {
      knowledgeAreaFills.push({
        legacySlug,
        legacyDisciplineId,
        knowledgeAreaId,
      });
    }
  }

  for (const rule of LEGACY_ENEM_DISCIPLINE_MOVE_RULES) {
    const legacyDisciplineId =
      lookup.legacyDisciplineIdBySlug.get(rule.fromLegacySlug);
    const targetDisciplineId =
      lookup.disciplineIdBySlug.get(rule.toDisciplineSlug);
    const targetKnowledgeAreaId =
      lookup.knowledgeAreaIdByDisciplineSlug.get(rule.toDisciplineSlug) ?? null;

    if (!targetDisciplineId) {
      problems.push(`Discipline "${rule.toDisciplineSlug}" is missing; run taxonomy:seed first.`);
      continue;
    }

    if (targetKnowledgeAreaId !== lookup.knowledgeAreaIdBySlug.get(rule.fromLegacySlug)) {
      problems.push(
        `Discipline "${rule.toDisciplineSlug}" is not linked to knowledge area "${rule.fromLegacySlug}".`,
      );
      continue;
    }

    if (!legacyDisciplineId || !targetKnowledgeAreaId) {
      continue;
    }

    disciplineMoves.push({
      code: rule.code,
      legacyDisciplineId,
      targetDisciplineId,
      targetKnowledgeAreaId,
      signal: rule.signal,
    });
  }

  return { knowledgeAreaFills, disciplineMoves, problems };
}
