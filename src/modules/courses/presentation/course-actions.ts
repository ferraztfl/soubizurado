"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { nextLessonId } from "@/modules/courses/domain/course";
import { loadCourseOutline } from "@/modules/courses/infrastructure/course-access";
import { ensureProfileForAuthUser } from "@/modules/identity/application/ensure-profile";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Marks a lesson done (or not) for the signed-in student and moves on. */
export async function toggleLessonCompleteAction(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const slug = String(formData.get("courseSlug") ?? "");
  const lessonId = String(formData.get("lessonId") ?? "");
  const done = formData.get("done") === "true";

  if (!SLUG.test(slug) || !UUID.test(lessonId)) {
    redirect("/app/cursos");
  }

  const displayName = typeof user.user_metadata.display_name === "string" ? user.user_metadata.display_name : null;
  const profile = await ensureProfileForAuthUser({ authUserId: user.id, displayName });
  const course = await loadCourseOutline(slug, profile.id);
  const lesson = course?.modules.flatMap((module) => module.lessons).find((row) => row.id === lessonId);

  // Only lessons the student can open.
  if (!course || !lesson || !(course.hasAccess || lesson.isFreePreview)) {
    redirect(`/app/cursos/${SLUG.test(slug) ? slug : ""}`);
  }

  const prisma = getPrismaClient();

  if (done) {
    await prisma.courseLessonProgress.upsert({
      where: { profileId_lessonId: { profileId: profile.id, lessonId } },
      update: {},
      create: { profileId: profile.id, lessonId },
    });
  } else {
    await prisma.courseLessonProgress.deleteMany({ where: { profileId: profile.id, lessonId } });
  }

  revalidatePath(`/app/cursos/${slug}`, "layout");

  const next = done ? nextLessonId(course.orderedLessonIds, lessonId) : null;
  redirect(next ? `/app/cursos/${slug}/${next}` : `/app/cursos/${slug}/${lessonId}`);
}
