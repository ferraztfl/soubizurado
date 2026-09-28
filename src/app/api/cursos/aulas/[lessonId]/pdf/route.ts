import { findStudentProfileId } from "@/modules/study/infrastructure/queries/answered-question-status";
import { hasCourseAccess } from "@/modules/courses/infrastructure/course-access";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";
import { readStoredMedia } from "@/shared/infrastructure/media-storage/stored-media";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = Readonly<{ params: Promise<Readonly<{ lessonId: string }>> }>;

function notFound(): Response {
  // Same answer for "missing" and "not allowed": lesson ids are not confirmable.
  return new Response("Not found.", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

/** A lesson PDF, only for students with access to the course (or a free-preview lesson). */
export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { lessonId } = await context.params;
  if (!UUID.test(lessonId)) return notFound();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return notFound();

  const profileId = await findStudentProfileId(user.id);
  if (!profileId) return notFound();

  const lesson = await getPrismaClient().courseLesson.findUnique({
    where: { id: lessonId },
    select: {
      title: true,
      isFreePreview: true,
      module: { select: { course: { select: { id: true, isPublished: true } } } },
      pdf: { select: { storageProvider: true, bucket: true, storageKey: true } },
    },
  });

  if (!lesson?.pdf) return notFound();

  const allowed =
    (lesson.module.course.isPublished && lesson.isFreePreview) || (await hasCourseAccess(profileId, lesson.module.course.id));
  if (!allowed) return notFound();

  const bytes = await readStoredMedia(lesson.pdf);
  if (!bytes) return notFound();

  const download = new URL(request.url).searchParams.get("download") === "1";
  const filename = `${lesson.title.normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").slice(0, 80) || "aula"}.pdf`;

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
