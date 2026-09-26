"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import {
  startBatchAnalysis,
  startBatchImport,
} from "@/modules/imports/infrastructure/batch/batch-import-runner";

export async function startBatchAnalysisAction(): Promise<void> {
  await requireAdminUser();

  const batchId = await startBatchAnalysis();

  revalidatePath("/admin/importacoes/lote");
  redirect(batchId ? `/admin/importacoes/lote?lote=${batchId}` : "/admin/importacoes/lote?aviso=sem-pares");
}

export async function startBatchImportAction(formData: FormData): Promise<void> {
  await requireAdminUser();

  const batchId = String(formData.get("batchId") ?? "");
  const started = await startBatchImport(batchId);

  revalidatePath("/admin/importacoes/lote");
  redirect(`/admin/importacoes/lote?lote=${encodeURIComponent(batchId)}${started ? "" : "&aviso=nada-a-importar"}`);
}
