import type { PrismaClient } from "@/generated/prisma/client";

import { findByTaxonomyTerm, planManualTaxonomyName, type ManualTaxonomyLevel } from "../domain/manual-taxonomy-entry";

export type ManualPathError =
  | "question-unavailable"
  | "path-discipline"
  | "path-required"
  | "path-name"
  | "path-topic-elsewhere"
  | "path-conflict";

export type ManualPathResult =
  | Readonly<{ ok: true; created: readonly Readonly<{ level: ManualTaxonomyLevel; id: string; name: string }>[] }>
  | Readonly<{ ok: false; error: ManualPathError; detail?: string }>;

/**
 * Classifies a question in review by a typed path (Tópico › Subtópico ›
 * Detalhe inside a discipline of the question knowledge area), creating the
 * levels that do not exist yet. Each level is matched by normalized name or
 * alias first, so an existing entry is reused instead of duplicated. Only an
 * administrator calls this (the action checks it); every creation goes to the
 * admin audit log, which `taxonomy:export-manual` reads.
 */
export async function classifyWithManualPath(
  prisma: PrismaClient,
  input: Readonly<{
    questionId: string;
    disciplineId: string;
    area: string;
    topic: string;
    subtopic: string;
    actorProfileId: string;
  }>,
): Promise<ManualPathResult> {
  const area = planManualTaxonomyName("area", input.area);
  const topic = planManualTaxonomyName("topic", input.topic);
  const subtopic = planManualTaxonomyName("subtopic", input.subtopic);

  if (!area.ok || !topic.ok || !subtopic.ok) return { ok: false, error: "path-name" };
  if (!area.entry || !topic.entry) return { ok: false, error: "path-required" };

  const areaEntry = area.entry;
  const topicEntry = topic.entry;
  const subtopicEntry = subtopic.entry;

  try {
    return await prisma.$transaction(async (transaction) => {
      const question = await transaction.question.findFirst({
        where: { id: input.questionId, status: "IN_REVIEW" },
        select: { id: true, disciplineId: true, knowledgeAreaId: true, discipline: { select: { knowledgeAreaId: true } } },
      });
      const scope = question?.discipline?.knowledgeAreaId ?? question?.knowledgeAreaId ?? null;

      if (!question || !scope) return { ok: false, error: "question-unavailable" } as const;

      const discipline = await transaction.discipline.findFirst({
        where: { id: input.disciplineId, isActive: true, knowledgeAreaId: scope },
        select: {
          id: true,
          name: true,
          knowledgeAreaId: true,
          areas: { select: { id: true, name: true, isActive: true, sortOrder: true, aliases: { select: { normalizedName: true } } } },
          topics: {
            select: {
              id: true,
              name: true,
              isActive: true,
              sortOrder: true,
              areaId: true,
              area: { select: { name: true } },
              aliases: { select: { normalizedName: true } },
              subtopics: { select: { id: true, name: true, isActive: true, sortOrder: true, aliases: { select: { normalizedName: true } } } },
            },
          },
        },
      });

      if (!discipline) return { ok: false, error: "path-discipline" } as const;

      const created: { level: ManualTaxonomyLevel; id: string; name: string }[] = [];
      const nextOrder = (entries: readonly Readonly<{ sortOrder: number }>[]) =>
        entries.reduce((max, entry) => Math.max(max, entry.sortOrder), 0) + 10;

      let areaRow = findByTaxonomyTerm(discipline.areas, areaEntry.normalized);
      // Topics are unique per discipline, whatever the area.
      const topicRow = findByTaxonomyTerm(discipline.topics, topicEntry.normalized);

      if (areaRow && !areaRow.isActive) return { ok: false, error: "path-conflict", detail: areaRow.name } as const;
      if (topicRow && !topicRow.isActive) return { ok: false, error: "path-conflict", detail: topicRow.name } as const;

      if (topicRow && topicRow.areaId !== (areaRow?.id ?? null)) {
        return {
          ok: false,
          error: "path-topic-elsewhere",
          detail: `${discipline.name} › ${topicRow.area?.name ?? "Sem tópico"} › ${topicRow.name}`,
        } as const;
      }

      if (!areaRow) {
        const row = await transaction.area.create({
          data: { disciplineId: discipline.id, name: areaEntry.name, slug: areaEntry.slug, sortOrder: nextOrder(discipline.areas) },
          select: { id: true, name: true },
        });

        areaRow = { ...row, isActive: true, sortOrder: 0, aliases: [] };
        created.push({ level: "area", id: row.id, name: row.name });
      }

      let topicId = topicRow?.id ?? null;
      let subtopics = topicRow?.subtopics ?? [];

      if (!topicId) {
        const row = await transaction.topic.create({
          data: {
            disciplineId: discipline.id,
            areaId: areaRow.id,
            name: topicEntry.name,
            slug: topicEntry.slug,
            sortOrder: nextOrder(discipline.topics.filter((candidate) => candidate.areaId === areaRow.id)),
          },
          select: { id: true, name: true },
        });

        topicId = row.id;
        subtopics = [];
        created.push({ level: "topic", id: row.id, name: row.name });
      }

      let subtopicId: string | null = null;

      if (subtopicEntry) {
        const subtopicRow = findByTaxonomyTerm(subtopics, subtopicEntry.normalized);

        if (subtopicRow && !subtopicRow.isActive) return { ok: false, error: "path-conflict", detail: subtopicRow.name } as const;

        if (subtopicRow) {
          subtopicId = subtopicRow.id;
        } else {
          const row = await transaction.subtopic.create({
            data: { topicId, name: subtopicEntry.name, slug: subtopicEntry.slug, sortOrder: nextOrder(subtopics) },
            select: { id: true, name: true },
          });

          subtopicId = row.id;
          created.push({ level: "subtopic", id: row.id, name: row.name });
        }
      }

      const updated = await transaction.question.updateMany({
        where: { id: question.id, status: "IN_REVIEW", disciplineId: question.disciplineId },
        data: { knowledgeAreaId: discipline.knowledgeAreaId, disciplineId: discipline.id, areaId: areaRow.id, topicId, subtopicId },
      });

      if (updated.count !== 1) throw new ManualPathAbort("question-unavailable");

      if (created.length > 0) {
        await transaction.adminAuditLog.create({
          data: {
            actorProfileId: input.actorProfileId,
            action: "taxonomy.create",
            details: {
              questionId: question.id,
              discipline: discipline.name,
              area: areaRow.name,
              topic: topicRow?.name ?? topicEntry.name,
              subtopic: subtopicEntry?.name ?? null,
              created,
            },
          },
        });
      }

      return { ok: true, created } as const;
    });
  } catch (error) {
    if (error instanceof ManualPathAbort) return { ok: false, error: error.code };

    // Unique violation: someone created the same entry at the same time (or the slug collides).
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return { ok: false, error: "path-conflict" };
    }

    throw error;
  }
}

class ManualPathAbort extends Error {
  public constructor(public readonly code: ManualPathError) {
    super(code);
  }
}
