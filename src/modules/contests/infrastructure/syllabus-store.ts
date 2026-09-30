import { normalizeTaxonomyTerm } from "@/modules/taxonomy/domain/taxonomy-term";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import type { SyllabusPlan, SyllabusSubjectPlan } from "../domain/syllabus";

/*
 * Storage of the "edital verticalizado". Saving keeps the rows of subjects and
 * topics that did not change (matched by name / code + text), so the
 * students' checklist survives edits of the syllabus.
 */

/** Subject name → active discipline of the taxonomy (by name or alias). Never creates disciplines. */
export async function matchDisciplines(names: readonly string[]): Promise<Map<string, string>> {
  const prisma = getPrismaClient();
  const wanted = new Map(names.map((name) => [normalizeTaxonomyTerm(name), name]));
  const keys = [...wanted.keys()];
  if (keys.length === 0) return new Map();

  const [disciplines, aliases] = await Promise.all([
    prisma.discipline.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.disciplineAlias.findMany({
      where: { normalizedName: { in: keys }, discipline: { isActive: true } },
      select: { disciplineId: true, normalizedName: true },
    }),
  ]);

  const found = new Map<string, string>();
  for (const discipline of disciplines) {
    const name = wanted.get(normalizeTaxonomyTerm(discipline.name));
    if (name && !found.has(name)) found.set(name, discipline.id);
  }
  for (const alias of aliases) {
    const name = wanted.get(alias.normalizedName);
    if (name && !found.has(name)) found.set(name, alias.disciplineId);
  }
  return found;
}

const topicKey = (code: string | null, text: string) => `${code ?? ""}|${normalizeTaxonomyTerm(text)}`;

/** Creates or updates one position's syllabus of a contest. Returns its id. */
export async function saveSyllabus(contestId: string, plan: SyllabusPlan, syllabusId: string | null): Promise<string> {
  const prisma = getPrismaClient();
  const disciplines = await matchDisciplines(plan.subjects.map((subject) => subject.name));

  return prisma.$transaction(async (transaction) => {
    const data = {
      title: plan.title,
      slug: plan.slug,
      essayPoints: plan.essayPoints,
      durationMinutes: plan.durationMinutes,
      notes: plan.notes,
      isPublished: plan.isPublished,
    };
    const row = syllabusId
      ? await transaction.contestSyllabus.update({ where: { id: syllabusId, contestId }, data, select: { id: true } })
      : await transaction.contestSyllabus.create({
          data: { ...data, contestId, sortOrder: await transaction.contestSyllabus.count({ where: { contestId } }) },
          select: { id: true },
        });

    const existing = await transaction.contestSyllabusSubject.findMany({
      where: { syllabusId: row.id },
      select: { id: true, name: true, topics: { select: { id: true, code: true, text: true } } },
    });
    const bySubject = new Map(existing.map((subject) => [normalizeTaxonomyTerm(subject.name), subject]));
    const keptSubjects = new Set<string>();

    for (const [subjectIndex, subject] of plan.subjects.entries()) {
      const previous = bySubject.get(normalizeTaxonomyTerm(subject.name));
      const subjectData = {
        name: subject.name,
        questionCount: subject.questionCount,
        block: subject.block,
        disciplineId: disciplines.get(subject.name) ?? null,
        sortOrder: subjectIndex,
      };
      const subjectId = previous
        ? (await transaction.contestSyllabusSubject.update({ where: { id: previous.id }, data: subjectData, select: { id: true } })).id
        : (await transaction.contestSyllabusSubject.create({ data: { ...subjectData, syllabusId: row.id }, select: { id: true } })).id;
      if (previous) keptSubjects.add(previous.id);

      await saveTopics(transaction, subjectId, subject, previous?.topics ?? []);
    }

    const removed = existing.filter((subject) => !keptSubjects.has(subject.id)).map((subject) => subject.id);
    if (removed.length > 0) await transaction.contestSyllabusSubject.deleteMany({ where: { id: { in: removed } } });

    return row.id;
  });
}

type Transaction = Parameters<Parameters<ReturnType<typeof getPrismaClient>["$transaction"]>[0]>[0];

async function saveTopics(
  transaction: Transaction,
  subjectId: string,
  subject: SyllabusSubjectPlan,
  previous: readonly { id: string; code: string | null; text: string }[],
): Promise<void> {
  const byKey = new Map(previous.map((topic) => [topicKey(topic.code, topic.text), topic.id]));
  const byText = new Map(previous.map((topic) => [topicKey(null, topic.text), topic.id]));
  const kept = new Set<string>();
  const created: { subjectId: string; code: string | null; text: string; sortOrder: number }[] = [];

  for (const [index, topic] of subject.topics.entries()) {
    // Same code and text first; then same text (renumbered topic).
    const candidates = [byKey.get(topicKey(topic.code, topic.text)), byText.get(topicKey(null, topic.text))];
    const id = candidates.find((candidate): candidate is string => candidate !== undefined && !kept.has(candidate));
    if (id) {
      kept.add(id);
      await transaction.contestSyllabusTopic.update({ where: { id }, data: { code: topic.code, text: topic.text, sortOrder: index } });
    } else {
      created.push({ subjectId, code: topic.code, text: topic.text, sortOrder: index });
    }
  }

  const removed = previous.filter((topic) => !kept.has(topic.id)).map((topic) => topic.id);
  if (removed.length > 0) await transaction.contestSyllabusTopic.deleteMany({ where: { id: { in: removed } } });
  if (created.length > 0) await transaction.contestSyllabusTopic.createMany({ data: created });
}

const SYLLABUS_SELECT = {
  id: true,
  title: true,
  slug: true,
  essayPoints: true,
  durationMinutes: true,
  notes: true,
  isPublished: true,
  sortOrder: true,
  subjects: {
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      questionCount: true,
      block: true,
      discipline: { select: { id: true, name: true, slug: true } },
      topics: { orderBy: { sortOrder: "asc" }, select: { id: true, code: true, text: true } },
    },
  },
} as const;

/** All syllabi of a contest (admin). */
export async function loadContestSyllabi(contestId: string) {
  return getPrismaClient().contestSyllabus.findMany({
    where: { contestId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: SYLLABUS_SELECT,
  });
}

/** Published syllabi of a published contest, for the public pages. */
export async function loadPublishedSyllabi(contestId: string) {
  return getPrismaClient().contestSyllabus.findMany({
    where: { contestId, isPublished: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: SYLLABUS_SELECT,
  });
}

export type LoadedSyllabus = Awaited<ReturnType<typeof loadContestSyllabi>>[number];

/** Topic ids of these syllabi the student marked as studied. */
export async function loadStudiedTopicIds(profileId: string, topicIds: readonly string[]): Promise<Set<string>> {
  if (topicIds.length === 0) return new Set();
  const rows = await getPrismaClient().studySyllabusProgress.findMany({
    where: { profileId, topicId: { in: [...topicIds] } },
    select: { topicId: true },
  });
  return new Set(rows.map((row) => row.topicId));
}
