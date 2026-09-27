"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

const closeSchema = z.object({
  reportId: z.uuid(),
  status: z.enum(["RESOLVED", "DISMISSED"]),
  resolutionNote: z
    .string()
    .trim()
    .max(500, "Nota longa demais (até 500 caracteres).")
    .transform((value) => value || null),
});

function back(query: string): never {
  redirect(`/admin/questoes/reportes?${query}`);
}

/**
 * Closes an open report as resolved (the question was fixed, via the edit
 * page) or dismissed (no problem found). Question content is never changed
 * here.
 */
export async function closeQuestionErrorReportAction(formData: FormData): Promise<void> {
  const admin = await requireAdminUser();

  const parsed = closeSchema.safeParse({
    reportId: formData.get("reportId") ?? "",
    status: formData.get("status") ?? "",
    resolutionNote: formData.get("resolutionNote") ?? "",
  });

  if (!parsed.success) {
    back(`error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Dados inválidos.")}`);
  }

  const result = await getPrismaClient().questionErrorReport.updateMany({
    where: { id: parsed.data.reportId, status: "OPEN" },
    data: {
      status: parsed.data.status,
      resolutionNote: parsed.data.resolutionNote,
      resolverProfileId: admin.profileId,
      resolvedAt: new Date(),
    },
  });

  if (result.count === 0) {
    back(`error=${encodeURIComponent("Este reporte já foi fechado.")}`);
  }

  revalidatePath("/admin/questoes/reportes");
  back(`closed=${parsed.data.status === "RESOLVED" ? "resolvido" : "descartado"}`);
}
