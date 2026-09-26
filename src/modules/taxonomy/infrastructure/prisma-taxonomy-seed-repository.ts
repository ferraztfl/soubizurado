import type { PrismaClient } from "@/generated/prisma/client";

import type {
  TaxonomySeedPlan,
  TaxonomySnapshot,
} from "../application/build-taxonomy-seed-plan";

export async function loadTaxonomySnapshot(
  prisma: PrismaClient,
): Promise<TaxonomySnapshot> {
  const [
    knowledgeAreas,
    disciplines,
    areas,
    topics,
    subtopics,
    disciplineAliases,
    areaAliases,
    topicAliases,
    subtopicAliases,
    revisions,
  ] = await Promise.all([
    prisma.knowledgeArea.findMany({ select: { id: true, slug: true } }),
    prisma.discipline.findMany({
      select: { id: true, slug: true, knowledgeAreaId: true },
    }),
    prisma.area.findMany({
      select: { id: true, disciplineId: true, slug: true },
    }),
    prisma.topic.findMany({
      select: { id: true, disciplineId: true, areaId: true, slug: true },
    }),
    prisma.subtopic.findMany({
      select: { id: true, topicId: true, slug: true },
    }),
    prisma.disciplineAlias.findMany({
      select: { disciplineId: true, normalizedName: true },
    }),
    prisma.areaAlias.findMany({
      select: { areaId: true, disciplineId: true, normalizedName: true },
    }),
    prisma.topicAlias.findMany({
      select: { topicId: true, disciplineId: true, normalizedName: true },
    }),
    prisma.subtopicAlias.findMany({
      select: { subtopicId: true, topicId: true, normalizedName: true },
    }),
    prisma.taxonomyRevision.findMany({ select: { version: true } }),
  ]);

  return {
    knowledgeAreas,
    disciplines,
    areas,
    topics,
    subtopics,
    disciplineAliases,
    areaAliases,
    topicAliases,
    subtopicAliases,
    revisionVersions: revisions.map((revision) => revision.version),
  };
}

/**
 * Writes a conflict-free plan atomically, parents before children.
 * Unique constraints still guard against a concurrent writer: any
 * violation aborts the whole transaction.
 */
export async function applyTaxonomySeedPlan(
  prisma: PrismaClient,
  plan: TaxonomySeedPlan,
  createdByProfileId: string | null,
): Promise<void> {
  if (plan.conflicts.length > 0) {
    throw new Error(
      "Refusing to apply a taxonomy seed plan with conflicts.",
    );
  }

  await prisma.$transaction(
    async (transaction) => {
      if (plan.knowledgeAreas.length > 0) {
        await transaction.knowledgeArea.createMany({
          data: [...plan.knowledgeAreas],
        });
      }

      if (plan.disciplines.length > 0) {
        await transaction.discipline.createMany({
          data: [...plan.disciplines],
        });
      }

      for (const link of plan.disciplineKnowledgeAreaLinks) {
        // Guarded so a concurrent link is never overwritten.
        await transaction.discipline.updateMany({
          where: { id: link.disciplineId, knowledgeAreaId: null },
          data: { knowledgeAreaId: link.knowledgeAreaId },
        });
      }

      if (plan.areas.length > 0) {
        await transaction.area.createMany({ data: [...plan.areas] });
      }

      if (plan.topics.length > 0) {
        await transaction.topic.createMany({ data: [...plan.topics] });
      }

      if (plan.subtopics.length > 0) {
        await transaction.subtopic.createMany({
          data: [...plan.subtopics],
        });
      }

      if (plan.disciplineAliases.length > 0) {
        await transaction.disciplineAlias.createMany({
          data: plan.disciplineAliases.map((alias) => ({
            ...alias,
            source: "SEED" as const,
          })),
        });
      }

      if (plan.areaAliases.length > 0) {
        await transaction.areaAlias.createMany({
          data: plan.areaAliases.map((alias) => ({
            ...alias,
            source: "SEED" as const,
          })),
        });
      }

      if (plan.topicAliases.length > 0) {
        await transaction.topicAlias.createMany({
          data: plan.topicAliases.map((alias) => ({
            ...alias,
            source: "SEED" as const,
          })),
        });
      }

      if (plan.subtopicAliases.length > 0) {
        await transaction.subtopicAlias.createMany({
          data: plan.subtopicAliases.map((alias) => ({
            ...alias,
            source: "SEED" as const,
          })),
        });
      }

      if (plan.revision) {
        await transaction.taxonomyRevision.create({
          data: {
            ...plan.revision,
            createdByProfileId,
          },
        });
      }
    },
    {
      maxWait: 20_000,
      timeout: 120_000,
    },
  );
}
