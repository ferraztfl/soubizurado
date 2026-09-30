"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  isLessonKind,
  parseQuestionCodes,
  planLesson,
  slugifyCourse,
  type LessonError,
} from "@/modules/courses/domain/course";
import { isLessonContentStatus } from "@/modules/courses/domain/theory-course";
import { InvalidPdfError, uploadLessonPdf } from "@/modules/courses/infrastructure/lesson-pdf-storage";
import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readId(formData: FormData, key: string): string | null {
  const value = readString(formData, key);
  return UUID.test(value) ? value : null;
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function refresh(courseId: string) {
  revalidatePath("/admin/cursos");
  revalidatePath(`/admin/cursos/${courseId}`);
  revalidatePath("/app/cursos", "layout");
}

// ------------------------------------------------------------------ course

export async function saveCourseAction(formData: FormData): Promise<void> {
  await requireAdminUser();

  const courseId = readId(formData, "courseId");
  const back = courseId ? `/admin/cursos/${courseId}` : "/admin/cursos";
  const title = readString(formData, "title").replace(/\s+/g, " ").trim();
  const slug = (readString(formData, "slug").trim() || slugifyCourse(title)).toLowerCase();
  const subtitle = readString(formData, "subtitle").replace(/\s+/g, " ").trim();
  const description = readString(formData, "description").replace(/\r\n/g, "\n").trim();

  if (title.length < 3 || title.length > 160) fail(back, "Informe o título do curso (3 a 160 caracteres).");
  if (!SLUG.test(slug) || slug.length > 120) fail(back, "O endereço (slug) aceita só letras minúsculas, números e hífens.");
  if (subtitle.length > 240 || description.length > 20_000) fail(back, "Subtítulo ou descrição longos demais.");

  const prisma = getPrismaClient();
  const taken = await prisma.course.findUnique({ where: { slug }, select: { id: true } });
  if (taken && taken.id !== courseId) fail(back, "Já existe outro curso com esse endereço (slug).");

  const data = {
    title,
    slug,
    subtitle: subtitle || null,
    description,
    isPublished: formData.get("isPublished") === "on",
    sortOrder: Math.max(-1000, Math.min(1000, Math.trunc(Number(readString(formData, "sortOrder")) || 0))),
  };

  const saved = courseId
    ? await prisma.course.update({ where: { id: courseId }, data, select: { id: true } })
    : await prisma.course.create({ data, select: { id: true } });

  refresh(saved.id);
  redirect(`/admin/cursos/${saved.id}?ok=curso`);
}

// ----------------------------------------------------------------- modules

export async function saveModuleAction(formData: FormData): Promise<void> {
  await requireAdminUser();

  const courseId = readId(formData, "courseId");
  const moduleId = readId(formData, "moduleId");
  const title = readString(formData, "title").replace(/\s+/g, " ").trim();

  if (!courseId) fail("/admin/cursos", "Curso inválido.");
  if (title.length < 2 || title.length > 160) fail(`/admin/cursos/${courseId}`, "Informe o título do módulo.");

  const prisma = getPrismaClient();

  if (moduleId) {
    await prisma.courseModule.updateMany({ where: { id: moduleId, courseId }, data: { title } });
  } else {
    const last = await prisma.courseModule.aggregate({ where: { courseId }, _max: { position: true } });
    await prisma.courseModule.create({ data: { courseId, title, position: (last._max.position ?? -1) + 1 } });
  }

  refresh(courseId);
  redirect(`/admin/cursos/${courseId}`);
}

export async function moveModuleAction(formData: FormData): Promise<void> {
  await requireAdminUser();

  const courseId = readId(formData, "courseId");
  const moduleId = readId(formData, "moduleId");
  const direction = readString(formData, "direction") === "up" ? -1 : 1;

  if (!courseId || !moduleId) fail("/admin/cursos", "Módulo inválido.");

  const prisma = getPrismaClient();
  const modules = await prisma.courseModule.findMany({ where: { courseId }, orderBy: { position: "asc" }, select: { id: true } });
  const index = modules.findIndex((row) => row.id === moduleId);
  const target = modules[index + direction];

  if (index >= 0 && target) {
    // Rewrite positions in order (stable, no collisions).
    const reordered = [...modules];
    [reordered[index], reordered[index + direction]] = [target, modules[index]!];
    await prisma.$transaction(reordered.map((row, position) => prisma.courseModule.update({ where: { id: row.id }, data: { position } })));
  }

  refresh(courseId);
  redirect(`/admin/cursos/${courseId}`);
}

/** Only empty modules can be removed (lessons are deleted one by one, on purpose). */
export async function deleteModuleAction(formData: FormData): Promise<void> {
  await requireAdminUser();

  const courseId = readId(formData, "courseId");
  const moduleId = readId(formData, "moduleId");
  if (!courseId || !moduleId) fail("/admin/cursos", "Módulo inválido.");

  const prisma = getPrismaClient();
  if ((await prisma.courseLesson.count({ where: { moduleId } })) > 0) {
    fail(`/admin/cursos/${courseId}`, "Remova as aulas do módulo antes de excluí-lo.");
  }

  await prisma.courseModule.deleteMany({ where: { id: moduleId, courseId } });
  refresh(courseId);
  redirect(`/admin/cursos/${courseId}`);
}

// ----------------------------------------------------------------- lessons

export async function createLessonAction(formData: FormData): Promise<void> {
  await requireAdminUser();

  const courseId = readId(formData, "courseId");
  const moduleId = readId(formData, "moduleId");
  const title = readString(formData, "title").replace(/\s+/g, " ").trim();
  const kind = readString(formData, "kind");

  if (!courseId || !moduleId) fail("/admin/cursos", "Módulo inválido.");
  if (title.length < 2 || title.length > 160 || !isLessonKind(kind)) fail(`/admin/cursos/${courseId}`, "Informe o título e o tipo da aula.");

  const prisma = getPrismaClient();
  const owner = await prisma.courseModule.findFirst({ where: { id: moduleId, courseId }, select: { id: true } });
  if (!owner) fail(`/admin/cursos/${courseId}`, "Módulo inválido.");

  const last = await prisma.courseLesson.aggregate({ where: { moduleId }, _max: { position: true } });
  const lesson = await prisma.courseLesson.create({
    data: { moduleId, title, kind, position: (last._max.position ?? -1) + 1 },
    select: { id: true },
  });

  refresh(courseId);
  redirect(`/admin/cursos/${courseId}/aulas/${lesson.id}`);
}

const lessonErrors: Readonly<Record<LessonError, string>> = {
  TITLE_REQUIRED: "Informe o título da aula (2 a 160 caracteres).",
  KIND_INVALID: "Tipo de aula inválido.",
  VIDEO_URL_INVALID: "Link de vídeo não aceito: use o link de incorporação (embed) do Panda Video, Bunny, Vimeo ou YouTube.",
  DURATION_INVALID: "Duração inválida (1 a 1440 minutos).",
  BODY_TOO_LONG: "Texto da aula longo demais.",
};

export async function saveLessonAction(formData: FormData): Promise<void> {
  await requireAdminUser();

  const courseId = readId(formData, "courseId");
  const lessonId = readId(formData, "lessonId");
  if (!courseId || !lessonId) fail("/admin/cursos", "Aula inválida.");

  const back = `/admin/cursos/${courseId}/aulas/${lessonId}`;
  const prisma = getPrismaClient();
  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId, module: { courseId } },
    select: { id: true, pdfAssetId: true },
  });
  if (!lesson) fail(`/admin/cursos/${courseId}`, "Aula não encontrada.");

  const status = readString(formData, "contentStatus");
  const contentStatus = isLessonContentStatus(status) ? status : undefined;

  const result = planLesson({
    title: readString(formData, "title"),
    kind: readString(formData, "kind"),
    body: readString(formData, "body"),
    videoEmbedUrl: readString(formData, "videoEmbedUrl"),
    durationMinutes: readString(formData, "durationMinutes"),
  });

  if (!result.ok) fail(back, lessonErrors[result.error]);

  // Curated questions: only published ones, in the typed order.
  const numbers = parseQuestionCodes(readString(formData, "questionCodes"));
  const found = numbers.length
    ? await prisma.question.findMany({ where: { publicNumber: { in: numbers }, status: "PUBLISHED" }, select: { id: true, publicNumber: true } })
    : [];
  const missing = numbers.filter((number) => !found.some((row) => row.publicNumber === number));

  if (missing.length > 0) {
    fail(back, `Questões não encontradas ou não publicadas: ${missing.slice(0, 10).map((number) => `Q${number}`).join(", ")}.`);
  }

  const file = formData.get("pdf");
  let pdfAssetId = lesson.pdfAssetId;

  if (file && typeof file === "object" && "arrayBuffer" in file && file.size > 0) {
    try {
      const upload = await uploadLessonPdf(file);
      const asset = await prisma.mediaAsset.upsert({
        where: { checksum: upload.checksum },
        update: {},
        create: {
          checksum: upload.checksum,
          storageProvider: upload.provider,
          bucket: upload.bucket,
          storageKey: upload.storageKey,
          mimeType: "application/pdf",
          sizeBytes: BigInt(upload.sizeBytes),
          altText: result.lesson.title.slice(0, 500),
          sourceUrl: "admin-course-upload",
        },
        select: { id: true },
      });
      pdfAssetId = asset.id;
    } catch (error) {
      fail(back, error instanceof InvalidPdfError ? error.message : "Não foi possível enviar o PDF.");
    }
  } else if (formData.get("removePdf") === "on") {
    pdfAssetId = null;
  }

  const byNumber = new Map(found.map((row) => [row.publicNumber, row.id]));

  await prisma.$transaction([
    prisma.courseLesson.update({
      where: { id: lesson.id },
      data: {
        title: result.lesson.title,
        kind: result.lesson.kind,
        body: result.lesson.body,
        videoEmbedUrl: result.lesson.videoEmbedUrl,
        durationMinutes: result.lesson.durationMinutes,
        isFreePreview: formData.get("isFreePreview") === "on",
        pdfAssetId,
        ...(contentStatus ? { contentStatus } : {}),
      },
    }),
    prisma.courseLessonQuestion.deleteMany({ where: { lessonId: lesson.id } }),
    prisma.courseLessonQuestion.createMany({
      data: numbers.map((number, position) => ({ lessonId: lesson.id, questionId: byNumber.get(number)!, position })),
    }),
  ]);

  refresh(courseId);
  redirect(`${back}?ok=1`);
}

export async function moveLessonAction(formData: FormData): Promise<void> {
  await requireAdminUser();

  const courseId = readId(formData, "courseId");
  const lessonId = readId(formData, "lessonId");
  const direction = readString(formData, "direction") === "up" ? -1 : 1;
  if (!courseId || !lessonId) fail("/admin/cursos", "Aula inválida.");

  const prisma = getPrismaClient();
  const lesson = await prisma.courseLesson.findFirst({ where: { id: lessonId, module: { courseId } }, select: { moduleId: true } });

  if (lesson) {
    const lessons = await prisma.courseLesson.findMany({ where: { moduleId: lesson.moduleId }, orderBy: { position: "asc" }, select: { id: true } });
    const index = lessons.findIndex((row) => row.id === lessonId);
    const target = lessons[index + direction];

    if (target) {
      const reordered = [...lessons];
      [reordered[index], reordered[index + direction]] = [target, lessons[index]!];
      await prisma.$transaction(reordered.map((row, position) => prisma.courseLesson.update({ where: { id: row.id }, data: { position } })));
    }
  }

  refresh(courseId);
  redirect(`/admin/cursos/${courseId}`);
}

export async function deleteLessonAction(formData: FormData): Promise<void> {
  await requireAdminUser();

  const courseId = readId(formData, "courseId");
  const lessonId = readId(formData, "lessonId");
  if (!courseId || !lessonId) fail("/admin/cursos", "Aula inválida.");

  if (formData.get("confirm") !== "on") {
    fail(`/admin/cursos/${courseId}/aulas/${lessonId}`, "Marque a confirmação para excluir a aula (o progresso dos alunos nela é apagado).");
  }

  await getPrismaClient().courseLesson.deleteMany({ where: { id: lessonId, module: { courseId } } });
  refresh(courseId);
  redirect(`/admin/cursos/${courseId}?ok=aula-excluida`);
}
