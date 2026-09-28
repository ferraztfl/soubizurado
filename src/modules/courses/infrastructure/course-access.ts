import { progressPercent } from "@/modules/courses/domain/course";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

/*
 * Who may see what in the member area. Access = an active COURSE
 * entitlement (bought through an offer, or granted) or the ADMIN role;
 * free-preview lessons open to any signed-in student.
 */

const activeEntitlement = (now: Date) => ({
  kind: "COURSE",
  revokedAt: null,
  startsAt: { lte: now },
  OR: [{ endsAt: null }, { endsAt: { gt: now } }],
});

export async function isAdminProfile(profileId: string): Promise<boolean> {
  const role = await getPrismaClient().userRole.findUnique({
    where: { profileId_role: { profileId, role: "ADMIN" } },
    select: { id: true },
  });
  return role !== null;
}

export async function hasCourseAccess(profileId: string, courseId: string, now = new Date()): Promise<boolean> {
  const [entitlement, admin] = await Promise.all([
    getPrismaClient().entitlement.findFirst({ where: { profileId, courseId, ...activeEntitlement(now) }, select: { id: true } }),
    isAdminProfile(profileId),
  ]);
  return entitlement !== null || admin;
}

export type MyCourse = Readonly<{
  slug: string;
  title: string;
  subtitle: string | null;
  totalLessons: number;
  completedLessons: number;
  percent: number;
  accessEndsAt: Date | null;
}>;

/** Published courses the student can open, with progress. */
export async function listMyCourses(profileId: string, now = new Date()): Promise<MyCourse[]> {
  const prisma = getPrismaClient();
  const [entitlements, admin] = await Promise.all([
    prisma.entitlement.findMany({ where: { profileId, ...activeEntitlement(now) }, select: { courseId: true, endsAt: true } }),
    isAdminProfile(profileId),
  ]);

  const ends = new Map<string, Date | null>();
  for (const row of entitlements) {
    if (!row.courseId) continue;
    const current = ends.get(row.courseId);
    ends.set(row.courseId, current === null || row.endsAt === null ? null : current && current > row.endsAt ? current : row.endsAt);
  }

  const courses = await prisma.course.findMany({
    where: { isPublished: true, ...(admin ? {} : { id: { in: [...ends.keys()] } }) },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      modules: { select: { lessons: { select: { id: true } } } },
    },
  });

  const lessonIds = courses.flatMap((course) => course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id)));
  const completed = new Set(
    (
      await prisma.courseLessonProgress.findMany({ where: { profileId, lessonId: { in: lessonIds } }, select: { lessonId: true } })
    ).map((row) => row.lessonId),
  );

  return courses.map((course) => {
    const ids = course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id));
    const done = ids.filter((id) => completed.has(id)).length;
    return {
      slug: course.slug,
      title: course.title,
      subtitle: course.subtitle,
      totalLessons: ids.length,
      completedLessons: done,
      percent: progressPercent(ids.length, done),
      accessEndsAt: ends.get(course.id) ?? null,
    };
  });
}

/** Course outline for the student (published courses; admins also see drafts). */
export async function loadCourseOutline(slug: string, profileId: string) {
  const prisma = getPrismaClient();
  const admin = await isAdminProfile(profileId);
  const course = await prisma.course.findFirst({
    where: { slug, ...(admin ? {} : { isPublished: true }) },
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      description: true,
      modules: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          lessons: {
            orderBy: { position: "asc" },
            select: { id: true, title: true, kind: true, durationMinutes: true, isFreePreview: true },
          },
        },
      },
    },
  });

  if (!course) return null;

  const lessonIds = course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id));
  const [hasAccess, progress, offer] = await Promise.all([
    hasCourseAccess(profileId, course.id),
    prisma.courseLessonProgress.findMany({ where: { profileId, lessonId: { in: lessonIds } }, select: { lessonId: true } }),
    // Where to buy it (the cheapest active offer that includes the course).
    prisma.offer.findFirst({
      where: { isActive: true, grants: { some: { kind: "COURSE", courseId: course.id } } },
      orderBy: { priceCents: "asc" },
      select: { slug: true },
    }),
  ]);

  return {
    ...course,
    orderedLessonIds: lessonIds,
    hasAccess,
    completed: new Set(progress.map((row) => row.lessonId)),
    offerSlug: offer?.slug ?? null,
  };
}

/**
 * True when the question is part of a lesson the student can open — course
 * questions do not consume the daily free answers.
 */
export async function isQuestionInAccessibleCourse(profileId: string, questionId: string, now = new Date()): Promise<boolean> {
  const prisma = getPrismaClient();
  const lessons = await prisma.courseLessonQuestion.findMany({
    where: { questionId, lesson: { module: { course: { isPublished: true } } } },
    select: { lesson: { select: { isFreePreview: true, module: { select: { courseId: true } } } } },
    take: 20,
  });

  if (lessons.length === 0) return false;
  if (lessons.some((row) => row.lesson.isFreePreview)) return true;

  const courseIds = [...new Set(lessons.map((row) => row.lesson.module.courseId))];
  const entitlement = await prisma.entitlement.findFirst({
    where: { profileId, courseId: { in: courseIds }, ...activeEntitlement(now) },
    select: { id: true },
  });

  return entitlement !== null;
}
