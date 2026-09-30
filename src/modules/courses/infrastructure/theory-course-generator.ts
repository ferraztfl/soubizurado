import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import { lessonContentKey, planTheoryCourse, theoryCourseSlug, theoryCourseTitle } from "../domain/theory-course";

/*
 * Creates (or completes) the "Teoria Completa" course of a position from its
 * edital verticalizado. Create-only: existing modules and lessons are kept
 * (with their text); topics added to the syllabus become new lessons. A lesson
 * whose subject and topic text match an already written lesson (another
 * position or contest) starts with that text and its status.
 */

export type TheoryCourseGeneration = Readonly<{
  courseId: string;
  courseSlug: string;
  created: boolean;
  modulesCreated: number;
  lessonsCreated: number;
  lessonsReused: number;
}>;

export async function generateTheoryCourse(syllabusId: string, dryRun = false): Promise<TheoryCourseGeneration> {
  const prisma = getPrismaClient();
  const syllabus = await prisma.contestSyllabus.findUnique({
    where: { id: syllabusId },
    select: {
      id: true,
      title: true,
      slug: true,
      contest: { select: { slug: true, name: true, organizationName: true } },
      subjects: {
        orderBy: { sortOrder: "asc" },
        select: { name: true, topics: { orderBy: { sortOrder: "asc" }, select: { id: true, code: true, text: true } } },
      },
    },
  });
  if (!syllabus) throw new Error("Edital verticalizado não encontrado.");

  const plan = planTheoryCourse(syllabus);
  const slug = theoryCourseSlug(syllabus.contest.slug, syllabus.slug);

  // Written lessons of any course, by content key (subject + topic text).
  const written = await prisma.courseLesson.findMany({
    where: { syllabusTopicId: { not: null }, contentStatus: { in: ["DRAFT", "REVIEWED"] } },
    select: { body: true, contentStatus: true, durationMinutes: true, syllabusTopic: { select: { text: true, subject: { select: { name: true } } } } },
    orderBy: { updatedAt: "desc" },
  });
  const library = new Map<string, (typeof written)[number]>();
  for (const lesson of written) {
    if (!lesson.syllabusTopic) continue;
    const key = lessonContentKey(lesson.syllabusTopic.subject.name, lesson.syllabusTopic.text);
    // Reviewed text wins over a draft for the same topic.
    const current = library.get(key);
    if (!current || (current.contentStatus !== "REVIEWED" && lesson.contentStatus === "REVIEWED")) library.set(key, lesson);
  }

  const existing = await prisma.course.findFirst({
    where: { OR: [{ syllabusId: syllabus.id }, { slug }] },
    select: {
      id: true,
      slug: true,
      modules: { select: { id: true, title: true, position: true, lessons: { select: { syllabusTopicId: true, position: true } } } },
    },
  });

  const counts = { modulesCreated: 0, lessonsCreated: 0, lessonsReused: 0 };
  const known = new Set(existing?.modules.flatMap((module) => module.lessons.map((lesson) => lesson.syllabusTopicId)) ?? []);
  for (const planned of plan) {
    const missing = planned.lessons.filter((lesson) => !known.has(lesson.syllabusTopicId));
    if (missing.length === 0) continue;
    if (!existing?.modules.some((row) => row.title === planned.title)) counts.modulesCreated += 1;
    counts.lessonsCreated += missing.length;
    counts.lessonsReused += missing.filter((lesson) => library.has(lesson.contentKey)).length;
  }

  if (dryRun) {
    return { courseId: existing?.id ?? "", courseSlug: existing?.slug ?? slug, created: !existing, ...counts };
  }

  const courseId = await prisma.$transaction(
    async (transaction) => {
      const course =
        existing ??
        (await transaction.course.create({
          data: {
            slug,
            title: theoryCourseTitle(syllabus.contest.name, syllabus.title),
            subtitle: `Todas as matérias do edital de ${syllabus.title}, na ordem do edital`.slice(0, 240),
            description: `Teoria de todas as matérias do edital (${syllabus.contest.organizationName}), com os assuntos na ordem do conteúdo programático, questões de cada assunto e acompanhamento do seu progresso.`,
            isPublished: false,
            syllabusId: syllabus.id,
          },
          select: { id: true, slug: true, modules: { select: { id: true, title: true, position: true, lessons: { select: { syllabusTopicId: true, position: true } } } } },
        }));

      let nextModulePosition = Math.max(-1, ...course.modules.map((module) => module.position)) + 1;
      for (const planned of plan) {
        const current = course.modules.find((row) => row.title === planned.title);
        const missing = planned.lessons.filter((lesson) => !known.has(lesson.syllabusTopicId));
        if (missing.length === 0) continue;

        const moduleId =
          current?.id ??
          (await transaction.courseModule.create({ data: { courseId: course.id, title: planned.title, position: nextModulePosition++ }, select: { id: true } })).id;
        let nextLessonPosition = Math.max(-1, ...(current?.lessons.map((lesson) => lesson.position) ?? [])) + 1;

        await transaction.courseLesson.createMany({
          data: missing.map((lesson) => {
            const reused = library.get(lesson.contentKey);
            return {
              moduleId,
              title: lesson.title,
              kind: "TEXT",
              position: nextLessonPosition++,
              body: reused?.body ?? "",
              durationMinutes: reused?.durationMinutes ?? null,
              contentStatus: reused?.contentStatus ?? "EMPTY",
              syllabusTopicId: lesson.syllabusTopicId,
            };
          }),
        });
      }
      return course.id;
    },
    { maxWait: 10_000, timeout: 60_000 },
  );

  return { courseId, courseSlug: existing?.slug ?? slug, created: !existing, ...counts };
}

/** Lessons of a course by content status (admin overview). */
export async function theoryCourseStatus(syllabusId: string) {
  const prisma = getPrismaClient();
  const course = await prisma.course.findFirst({ where: { syllabusId }, select: { id: true, slug: true, title: true, isPublished: true } });
  if (!course) return null;
  const rows = await prisma.courseLesson.groupBy({ by: ["contentStatus"], where: { module: { courseId: course.id } }, _count: true });
  const byStatus = Object.fromEntries(rows.map((row) => [row.contentStatus, row._count])) as Partial<Record<string, number>>;
  return { ...course, empty: byStatus.EMPTY ?? 0, draft: byStatus.DRAFT ?? 0, reviewed: byStatus.REVIEWED ?? 0 };
}
