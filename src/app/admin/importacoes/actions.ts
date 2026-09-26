"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { runClassificationBatch } from "@/modules/classification/infrastructure/run-classification-batch";
import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { analyzeExamJson } from "@/modules/imports/infrastructure/official-exams/analyze-exam-json";
import { analyzeOfficialExam } from "@/modules/imports/infrastructure/official-exams/analyze-official-exam";
import { confirmOfficialExamImport } from "@/modules/imports/infrastructure/official-exams/confirm-official-exam-import";
import {
  createJsonUpload,
  createUpload,
  isValidUploadId,
  loadAnalysis,
  saveAnalysis,
} from "@/modules/imports/infrastructure/official-exams/official-exam-upload-store";

function safeFileName(name: string): string {
  return name.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "arquivo.pdf";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 300) : "Erro inesperado.";
}

/**
 * Imports a "SouBizurado Exam JSON" (e.g. produced by an AI Studio app)
 * plus, when it references images, the booklet PDF to crop them from.
 */
export async function uploadExamJsonAction(formData: FormData): Promise<void> {
  await requireAdminUser();

  const json = formData.get("examJson");
  const booklet = formData.get("booklet");

  if (!(json instanceof File) || json.size === 0) {
    redirect(`/admin/importacoes/nova?error=${encodeURIComponent("Envie o arquivo JSON da prova.")}`);
  }

  const bookletFile = booklet instanceof File && booklet.size > 0 ? booklet : null;
  let uploadId: string;

  try {
    uploadId = await createJsonUpload({
      json: new Uint8Array(await json.arrayBuffer()),
      booklet: bookletFile ? new Uint8Array(await bookletFile.arrayBuffer()) : null,
    });

    const analysis = await analyzeExamJson(uploadId, {
      json: safeFileName(json.name),
      booklet: bookletFile ? safeFileName(bookletFile.name) : null,
    });

    await saveAnalysis(analysis);
  } catch (error) {
    redirect(`/admin/importacoes/nova?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath("/admin/importacoes");
  redirect(`/admin/importacoes/nova/${uploadId}`);
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

export async function confirmOfficialExamImportAction(formData: FormData): Promise<void> {
  await requireAdminUser();

  const uploadId = String(formData.get("uploadId") ?? "");

  if (!isValidUploadId(uploadId)) {
    redirect("/admin/importacoes");
  }

  const back = (query: string) => `/admin/importacoes/nova/${uploadId}?${query}`;
  const analysis = await loadAnalysis(uploadId);

  // The form names sections by index, in first-appearance order.
  const sectionNames = [...new Set((analysis?.questions ?? []).map((question) => question.section ?? ""))];
  const sectionChoices = Object.fromEntries(
    sectionNames.map((section, index) => [section, String(formData.get(`section-${index}`) ?? "auto")]),
  );

  let classificationEnqueued = 0;

  try {
    const result = await confirmOfficialExamImport({
      uploadId,
      boardSlug: String(formData.get("boardSlug") ?? ""),
      organization: formData.get("organization"),
      careerPosition: formData.get("careerPosition"),
      year: formData.get("year"),
      level: formData.get("level"),
      notice: formData.get("notice"),
      title: formData.get("title"),
      sectionChoices,
    });
    classificationEnqueued = result.classificationEnqueued;
  } catch (error) {
    redirect(back(`error=${encodeURIComponent(errorMessage(error))}`));
  }

  // Classification pipeline (rules → AI, confident results applied)
  // runs after the response so the upload does not wait for the AI
  // rate limit. Unfinished tasks stay queued for classification:process.
  if (classificationEnqueued > 0) {
    after(async () => {
      try {
        const batch = await runClassificationBatch({ limit: classificationEnqueued });
        console.info(
          `[classification] import ${uploadId}: ${batch.completed} completed, ${batch.applied} applied, ${batch.answeredByRules} by rules, ${batch.reviewRequired} for review, ${batch.failed} failed`,
        );
      } catch (error) {
        console.error(`[classification] import ${uploadId}: ${errorMessage(error)}`);
      }
    });
  }

  revalidatePath("/admin/importacoes");
  revalidatePath("/admin/questoes/revisao");
  revalidatePath("/admin");
  redirect(back("imported=1"));
}
