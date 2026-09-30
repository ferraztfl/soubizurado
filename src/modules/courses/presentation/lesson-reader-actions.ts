"use server";

import { ANNOTATION_LIMITS, clampScrollPercent, planAnnotation } from "@/modules/courses/domain/lesson-annotation";
import { loadCourseOutline } from "@/modules/courses/infrastructure/course-access";
import { findStudentProfileId } from "@/modules/study/infrastructure/queries/answered-question-status";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export type SavedAnnotation = Readonly<{ id: string; quote: string; prefix: string; suffix: string; note: string | null; color: string }>;
export type ReaderResult<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; message: string }>;

/** Signed-in student who may open this lesson (bought, admin or free preview). */
async function readerFor(courseSlug: string, lessonId: string): Promise<{ profileId: string; courseId: string } | null> {
  if (!SLUG.test(courseSlug) || !UUID.test(lessonId)) return null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const profileId = await findStudentProfileId(user.id);
  if (!profileId) return null;
  const course = await loadCourseOutline(courseSlug, profileId);
  const lesson = course?.modules.flatMap((module) => module.lessons).find((row) => row.id === lessonId);
  if (!course || !lesson || !(course.hasAccess || lesson.isFreePreview)) return null;
  return { profileId, courseId: course.id };
}

export async function saveAnnotationAction(
  courseSlug: string,
  lessonId: string,
  input: Readonly<{ quote: string; prefix: string; suffix: string; note: string; color: string }>,
): Promise<ReaderResult<SavedAnnotation>> {
  const reader = await readerFor(courseSlug, lessonId);
  if (!reader) return { ok: false, message: "Entre com a conta que tem acesso a esta aula." };
  const plan = planAnnotation({
    quote: String(input?.quote ?? ""),
    prefix: String(input?.prefix ?? ""),
    suffix: String(input?.suffix ?? ""),
    note: String(input?.note ?? ""),
    color: String(input?.color ?? ""),
  });
  if (!plan) return { ok: false, message: "Selecione um trecho de até 1.000 caracteres (nota até 2.000)." };

  const prisma = getPrismaClient();
  const count = await prisma.courseLessonAnnotation.count({ where: { profileId: reader.profileId, lessonId } });
  if (count >= ANNOTATION_LIMITS.perLessonMax) return { ok: false, message: "Limite de grifos nesta aula atingido." };

  const saved = await prisma.courseLessonAnnotation.create({
    data: { ...plan, profileId: reader.profileId, lessonId },
    select: { id: true, quote: true, prefix: true, suffix: true, note: true, color: true },
  });
  return { ok: true, value: saved };
}

export async function updateAnnotationNoteAction(courseSlug: string, lessonId: string, annotationId: string, note: string): Promise<ReaderResult<null>> {
  const reader = await readerFor(courseSlug, lessonId);
  if (!reader || !UUID.test(annotationId)) return { ok: false, message: "Não foi possível salvar a anotação." };
  const text = String(note ?? "").trim();
  if (text.length > ANNOTATION_LIMITS.noteMax) return { ok: false, message: "Anotação com até 2.000 caracteres." };
  const updated = await getPrismaClient().courseLessonAnnotation.updateMany({
    where: { id: annotationId, profileId: reader.profileId, lessonId },
    data: { note: text || null },
  });
  return updated.count === 1 ? { ok: true, value: null } : { ok: false, message: "Anotação não encontrada." };
}

export async function deleteAnnotationAction(courseSlug: string, lessonId: string, annotationId: string): Promise<ReaderResult<null>> {
  const reader = await readerFor(courseSlug, lessonId);
  if (!reader || !UUID.test(annotationId)) return { ok: false, message: "Não foi possível apagar." };
  await getPrismaClient().courseLessonAnnotation.deleteMany({ where: { id: annotationId, profileId: reader.profileId, lessonId } });
  return { ok: true, value: null };
}

/** Remembers where the student stopped in the course ("continuar de onde parei"). */
export async function saveReadingPositionAction(courseSlug: string, lessonId: string, scrollPercent: number): Promise<void> {
  const reader = await readerFor(courseSlug, lessonId);
  if (!reader) return;
  const percent = clampScrollPercent(Number(scrollPercent));
  await getPrismaClient().courseReadingState.upsert({
    where: { profileId_courseId: { profileId: reader.profileId, courseId: reader.courseId } },
    create: { profileId: reader.profileId, courseId: reader.courseId, lessonId, scrollPercent: percent },
    update: { lessonId, scrollPercent: percent },
  });
}
