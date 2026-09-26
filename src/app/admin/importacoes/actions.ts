"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import type { OfficialExamBoard } from "@/modules/imports/application/official-exams/official-exam";
import {
  resolveExamSection,
  type SectionResolution,
} from "@/modules/imports/application/official-exams/resolve-exam-section";
import { analyzeOfficialExam } from "@/modules/imports/infrastructure/official-exams/analyze-official-exam";
import {
  createUpload,
  isValidUploadId,
  loadAnalysis,
  saveAnalysis,
} from "@/modules/imports/infrastructure/official-exams/official-exam-upload-store";
import {
  loadSectionTaxonomyEntries,
  runOfficialExamImport,
} from "@/modules/imports/infrastructure/official-exams/run-official-exam-import";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

function safeFileName(name: string): string {
  return name.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "arquivo.pdf";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 300) : "Erro inesperado.";
}

export async function uploadOfficialExamAction(formData: FormData): Promise<void> {
  await requireAdminUser();

  const booklet = formData.get("booklet");
  const answerKey = formData.get("answerKey");

  if (!(booklet instanceof File) || !(answerKey instanceof File) || booklet.size === 0 || answerKey.size === 0) {
    redirect(`/admin/importacoes/nova?error=${encodeURIComponent("Envie o PDF da prova e o PDF do gabarito.")}`);
  }

  let uploadId: string;

  try {
    uploadId = await createUpload({
      booklet: new Uint8Array(await booklet.arrayBuffer()),
      answerKey: new Uint8Array(await answerKey.arrayBuffer()),
    });

    const analysis = await analyzeOfficialExam(uploadId, {
      booklet: safeFileName(booklet.name),
      answerKey: safeFileName(answerKey.name),
    });

    await saveAnalysis(analysis);
  } catch (error) {
    redirect(`/admin/importacoes/nova?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath("/admin/importacoes");
  redirect(`/admin/importacoes/nova/${uploadId}`);
}

const metadataSchema = z.object({
  organization: z.string().trim().min(2, "Informe o órgão.").max(200),
  careerPosition: z.string().trim().min(2, "Informe o cargo.").max(180),
  year: z.coerce.number().int().min(1990, "Ano inválido.").max(2100, "Ano inválido."),
  level: z.string().trim().max(40).optional(),
  notice: z.string().trim().max(160).optional(),
  title: z.string().trim().max(240).optional(),
});

export async function confirmOfficialExamImportAction(formData: FormData): Promise<void> {
  await requireAdminUser();

  const uploadId = String(formData.get("uploadId") ?? "");

  if (!isValidUploadId(uploadId)) {
    redirect("/admin/importacoes");
  }

  const back = (query: string) => `/admin/importacoes/nova/${uploadId}?${query}`;
  const analysis = await loadAnalysis(uploadId);

  if (!analysis?.board) {
    redirect(back(`error=${encodeURIComponent("Análise indisponível para este envio.")}`));
  }

  const parsed = metadataSchema.safeParse({
    organization: formData.get("organization"),
    careerPosition: formData.get("careerPosition"),
    year: formData.get("year"),
    level: formData.get("level") || undefined,
    notice: formData.get("notice") || undefined,
    title: formData.get("title") || undefined,
  });

  if (!parsed.success) {
    redirect(back(`error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Dados inválidos.")}`));
  }

  const board = analysis.board as OfficialExamBoard;
  const metadata = {
    board,
    organization: parsed.data.organization,
    careerPosition: parsed.data.careerPosition,
    year: parsed.data.year,
    level: parsed.data.level ?? null,
    notice: parsed.data.notice ?? null,
    title:
      parsed.data.title ||
      `${parsed.data.organization} ${parsed.data.year} – ${parsed.data.careerPosition}`,
  };

  // Section mapping: automatic resolution unless a reviewer chose a
  // canonical discipline or knowledge area. Choices are re-validated
  // against the current taxonomy.
  const entries = await loadSectionTaxonomyEntries();
  const knowledgeAreas = new Set(
    (await getPrismaClient().knowledgeArea.findMany({
      where: { isActive: true },
      select: { slug: true },
    })).map((area) => area.slug),
  );

  const sectionNames = [...new Set(analysis.questions.map((question) => question.section ?? ""))];
  const sections: Record<string, SectionResolution> = {};

  sectionNames.forEach((section, index) => {
    const choice = String(formData.get(`section-${index}`) ?? "auto");

    if (choice.startsWith("discipline:")) {
      const entry = entries.find((candidate) => candidate.disciplineName === choice.slice(11));
      sections[section] = entry
        ? { kind: "DISCIPLINE", disciplineName: entry.disciplineName, knowledgeAreaSlug: entry.knowledgeAreaSlug }
        : { kind: "UNRESOLVED" };
    } else if (choice.startsWith("area:") && knowledgeAreas.has(choice.slice(5))) {
      sections[section] = { kind: "KNOWLEDGE_AREA", knowledgeAreaSlug: choice.slice(5) };
    } else {
      sections[section] = resolveExamSection(section || null, entries);
    }
  });

  try {
    await runOfficialExamImport({ uploadId, metadata, sections });
  } catch (error) {
    redirect(back(`error=${encodeURIComponent(errorMessage(error))}`));
  }

  revalidatePath("/admin/importacoes");
  revalidatePath("/admin/questoes/revisao");
  revalidatePath("/admin");
  redirect(back("imported=1"));
}
