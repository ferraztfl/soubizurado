import type {
  Prisma,
  PrismaClient,
} from "@/generated/prisma/client";

import {
  LEGACY_ENEM_KNOWLEDGE_AREA_SLUGS,
  type DisciplineMoveRule,
  type KnowledgeAreaFillRule,
  type LegacyBackfillRules,
  type TaxonomyIdLookup,
} from "../application/legacy-enem-taxonomy-backfill";

const BATCH_SIZE = 500;

export type BackfillChange = Readonly<{
  questionId: string;
  rule: string;
  previous: Readonly<{ disciplineId: string | null; knowledgeAreaId: string | null }>;
  next: Readonly<{ disciplineId: string | null; knowledgeAreaId: string }>;
}>;

export type LegacyBackfillPlan = Readonly<{
  moves: readonly Readonly<{ rule: DisciplineMoveRule; changes: readonly BackfillChange[] }>[];
  fills: readonly Readonly<{ rule: KnowledgeAreaFillRule; changes: readonly BackfillChange[] }>[];
}>;

export async function loadTaxonomyIdLookup(
  prisma: PrismaClient,
): Promise<TaxonomyIdLookup> {
  const [disciplines, knowledgeAreas] = await Promise.all([
    prisma.discipline.findMany({
      select: {
        id: true,
        slug: true,
        knowledgeAreaId: true,
      },
    }),
    prisma.knowledgeArea.findMany({
      select: { id: true, slug: true },
    }),
  ]);

  const legacySlugs = new Set<string>(LEGACY_ENEM_KNOWLEDGE_AREA_SLUGS);

  return {
    legacyDisciplineIdBySlug: new Map(
      disciplines
        .filter((discipline) => legacySlugs.has(discipline.slug))
        .map((discipline) => [discipline.slug, discipline.id]),
    ),
    knowledgeAreaIdBySlug: new Map(
      knowledgeAreas.map((knowledgeArea) => [knowledgeArea.slug, knowledgeArea.id]),
    ),
    disciplineIdBySlug: new Map(
      disciplines.map((discipline) => [discipline.slug, discipline.id]),
    ),
    knowledgeAreaIdByDisciplineSlug: new Map(
      disciplines.map((discipline) => [discipline.slug, discipline.knowledgeAreaId]),
    ),
  };
}

/**
 * Only unclassified, unpublished questions move: changing the
 * discipline of a question with a topic or a published question would
 * silently alter reviewed content.
 */
function moveWhere(rule: DisciplineMoveRule): Prisma.QuestionWhereInput {
  const base: Prisma.QuestionWhereInput = {
    disciplineId: rule.legacyDisciplineId,
    status: { in: ["DRAFT", "IN_REVIEW"] },
    areaId: null,
    topicId: null,
    subtopicId: null,
  };

  if (rule.signal.kind === "ALL") {
    return base;
  }

  const matchesSuffix = {
    externalId: { endsWith: rule.signal.suffix },
  };

  return {
    ...base,
    occurrences: {
      some: matchesSuffix,
      every: matchesSuffix,
    },
  };
}

function fillWhere(rule: KnowledgeAreaFillRule): Prisma.QuestionWhereInput {
  return {
    disciplineId: rule.legacyDisciplineId,
    knowledgeAreaId: null,
  };
}

const changeSelect = {
  id: true,
  disciplineId: true,
  knowledgeAreaId: true,
} as const;

export async function buildLegacyBackfillPlan(
  prisma: PrismaClient,
  rules: LegacyBackfillRules,
): Promise<LegacyBackfillPlan> {
  if (rules.problems.length > 0) {
    throw new Error("Cannot plan a legacy backfill with unresolved rules.");
  }

  const movedIds = new Set<string>();
  const moves: LegacyBackfillPlan["moves"][number][] = [];

  for (const rule of rules.disciplineMoves) {
    const rows = await prisma.question.findMany({
      where: moveWhere(rule),
      select: changeSelect,
      orderBy: { id: "asc" },
    });

    const changes = rows
      .filter((row) => !movedIds.has(row.id))
      .map((row) => {
        movedIds.add(row.id);

        return {
          questionId: row.id,
          rule: `MOVE_${rule.code}`,
          previous: {
            disciplineId: row.disciplineId,
            knowledgeAreaId: row.knowledgeAreaId,
          },
          next: {
            disciplineId: rule.targetDisciplineId,
            knowledgeAreaId: rule.targetKnowledgeAreaId,
          },
        };
      });

    moves.push({ rule, changes });
  }

  const fills: LegacyBackfillPlan["fills"][number][] = [];

  for (const rule of rules.knowledgeAreaFills) {
    const rows = await prisma.question.findMany({
      where: fillWhere(rule),
      select: changeSelect,
      orderBy: { id: "asc" },
    });

    fills.push({
      rule,
      changes: rows
        .filter((row) => !movedIds.has(row.id))
        .map((row) => ({
          questionId: row.id,
          rule: `FILL_KNOWLEDGE_AREA_${rule.legacySlug}`,
          previous: {
            disciplineId: row.disciplineId,
            knowledgeAreaId: row.knowledgeAreaId,
          },
          next: {
            disciplineId: row.disciplineId,
            knowledgeAreaId: rule.knowledgeAreaId,
          },
        })),
    });
  }

  return { moves, fills };
}

function batches<T>(items: readonly T[]): T[][] {
  const result: T[][] = [];

  for (let index = 0; index < items.length; index += BATCH_SIZE) {
    result.push(items.slice(index, index + BATCH_SIZE));
  }

  return result;
}

/**
 * Applies exactly the planned rows. Guards are re-evaluated inside the
 * transaction; if any row changed since planning, the counts differ and
 * everything is rolled back.
 */
export async function applyLegacyBackfillPlan(
  prisma: PrismaClient,
  plan: LegacyBackfillPlan,
): Promise<void> {
  await prisma.$transaction(
    async (transaction) => {
      for (const { rule, changes } of plan.moves) {
        let updated = 0;

        for (const batch of batches(changes)) {
          const result = await transaction.question.updateMany({
            where: {
              AND: [
                moveWhere(rule),
                { id: { in: batch.map((change) => change.questionId) } },
              ],
            },
            data: {
              disciplineId: rule.targetDisciplineId,
              knowledgeAreaId: rule.targetKnowledgeAreaId,
            },
          });

          updated += result.count;
        }

        if (updated !== changes.length) {
          throw new Error(
            `MOVE_${rule.code}: expected ${changes.length} rows, updated ${updated}. Rolled back.`,
          );
        }
      }

      for (const { rule, changes } of plan.fills) {
        let updated = 0;

        for (const batch of batches(changes)) {
          const result = await transaction.question.updateMany({
            where: {
              AND: [
                fillWhere(rule),
                { id: { in: batch.map((change) => change.questionId) } },
              ],
            },
            data: {
              knowledgeAreaId: rule.knowledgeAreaId,
            },
          });

          updated += result.count;
        }

        if (updated !== changes.length) {
          throw new Error(
            `FILL ${rule.legacySlug}: expected ${changes.length} rows, updated ${updated}. Rolled back.`,
          );
        }
      }
    },
    {
      maxWait: 20_000,
      timeout: 120_000,
    },
  );
}
