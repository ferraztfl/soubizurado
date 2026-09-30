"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { planSyllabus, type SyllabusError, type SyllabusTextError } from "@/modules/contests/domain/syllabus";
import { resolveSyllabusLinks, saveSyllabus } from "@/modules/contests/infrastructure/syllabus-store";
import { generateTheoryCourse } from "@/modules/courses/infrastructure/theory-course-generator";
import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const errors: Readonly<Record<SyllabusError | "SLUG_TAKEN", string>> = {
  TITLE_REQUIRED: "Informe o cargo (2 a 160 caracteres).",
  SLUG_INVALID: "Endereço (slug) inválido.",
  ESSAY_INVALID: "Pontos da redação: use só números (ou deixe vazio).",
  DURATION_INVALID: "Duração da prova em minutos: use só números (ou deixe vazio).",
  NOTES_TOO_LONG: "Observações com até 2.000 caracteres.",
  TEXT_EMPTY: "Cole as matérias e os assuntos do edital.",
  SLUG_TAKEN: "Este concurso já tem outro cargo com esse endereço (slug).",
};

const textErrors: Readonly<Record<SyllabusTextError["reason"], string>> = {
  SUBJECT: "matéria inválida (formato: # Matéria | nº de questões | bloco | Disciplina > Área ou Tópico)",
  TOPIC_OUTSIDE_SUBJECT: "assunto antes da primeira matéria (comece com # Matéria)",
  TOPIC: "assunto vazio ou com mais de 600 caracteres",
  TOO_MANY: "limite de 40 matérias ou 200 assuntos por matéria",
};

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

/** Creates or updates the "edital verticalizado" of one position. */
export async function saveSyllabusAction(formData: FormData): Promise<void> {
  await requireAdminUser();

  const contestId = readString(formData, "contestId");
  if (!UUID.test(contestId)) fail("/admin/concursos", "Concurso inválido.");
  const back = `/admin/concursos/${contestId}/edital`;
  const syllabusId = UUID.test(readString(formData, "syllabusId")) ? readString(formData, "syllabusId") : null;

  const result = planSyllabus({
    title: readString(formData, "title"),
    slug: readString(formData, "slug"),
    essayPoints: readString(formData, "essayPoints"),
    durationMinutes: readString(formData, "durationMinutes"),
    notes: readString(formData, "notes"),
    text: readString(formData, "text"),
    isPublished: formData.get("isPublished") === "on",
  });
  if (!result.ok) {
    fail(back, result.error === "TEXT_INVALID" ? `Linha ${result.detail.line}: ${textErrors[result.detail.reason]}.` : errors[result.error]);
  }

  const prisma = getPrismaClient();
  const contest = await prisma.contest.findUnique({ where: { id: contestId }, select: { slug: true } });
  if (!contest) fail("/admin/concursos", "Concurso não encontrado.");

  const taken = await prisma.contestSyllabus.findUnique({
    where: { contestId_slug: { contestId, slug: result.syllabus.slug } },
    select: { id: true },
  });
  if (taken && taken.id !== syllabusId) fail(back, errors.SLUG_TAKEN);
  if (syllabusId && !(await prisma.contestSyllabus.findFirst({ where: { id: syllabusId, contestId }, select: { id: true } }))) {
    fail(back, "Cargo não encontrado neste concurso.");
  }

  const links = await resolveSyllabusLinks(result.syllabus.subjects);
  if (!links.ok) {
    fail(back, `Ligação com a taxonomia não encontrada em: ${links.unresolved.join(", ")}. Use “Disciplina” ou “Disciplina > Área ou Tópico” com os nomes da Taxonomia.`);
  }

  const savedId = await saveSyllabus(contestId, result.syllabus, syllabusId, links.links);

  revalidatePath(back);
  revalidatePath(`/concursos/${contest.slug}`);
  revalidatePath(`/concursos/${contest.slug}/o-que-estudar/${result.syllabus.slug}`);
  redirect(`${back}?ok=1#cargo-${savedId}`);
}

/** Creates (or completes with new topics) the "Teoria Completa" course of one position. Nothing is published. */
export async function generateTheoryCourseAction(formData: FormData): Promise<void> {
  await requireAdminUser();

  const contestId = readString(formData, "contestId");
  const syllabusId = readString(formData, "syllabusId");
  if (!UUID.test(contestId) || !UUID.test(syllabusId)) fail("/admin/concursos", "Cargo inválido.");
  const back = `/admin/concursos/${contestId}/edital`;

  const owned = await getPrismaClient().contestSyllabus.findFirst({ where: { id: syllabusId, contestId }, select: { id: true } });
  if (!owned) fail(back, "Cargo não encontrado neste concurso.");

  const result = await generateTheoryCourse(syllabusId);
  revalidatePath(back);
  revalidatePath("/admin/cursos");
  const message = result.created
    ? `Curso criado (rascunho): ${result.modulesCreated} matérias, ${result.lessonsCreated} aulas${result.lessonsReused ? `, ${result.lessonsReused} com texto reaproveitado` : ""}.`
    : result.lessonsCreated > 0
      ? `Curso atualizado: ${result.lessonsCreated} aulas novas${result.lessonsReused ? ` (${result.lessonsReused} com texto reaproveitado)` : ""}.`
      : "O curso já tem todos os assuntos do edital.";
  redirect(`${back}?info=${encodeURIComponent(message)}#cargo-${syllabusId}`);
}

/** Deletes one position's syllabus (and the students' checklist of it). */
export async function deleteSyllabusAction(formData: FormData): Promise<void> {
  await requireAdminUser();

  const contestId = readString(formData, "contestId");
  const syllabusId = readString(formData, "syllabusId");
  if (!UUID.test(contestId) || !UUID.test(syllabusId)) fail("/admin/concursos", "Cargo inválido.");
  const back = `/admin/concursos/${contestId}/edital`;
  if (formData.get("confirm") !== "on") fail(back, "Marque a confirmação para excluir o cargo.");

  const deleted = await getPrismaClient().contestSyllabus.deleteMany({ where: { id: syllabusId, contestId } });
  if (deleted.count === 0) fail(back, "Cargo não encontrado.");

  revalidatePath(back);
  redirect(`${back}?ok=1`);
}
