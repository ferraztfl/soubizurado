"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  startClassificationRun,
  stopClassificationRun,
} from "@/modules/classification/infrastructure/classification-run-manager";
import { requireAdminUser } from "@/modules/identity/application/require-admin-user";

const ALLOWED_LIMITS = new Set(["50", "300", "1000", "all"]);

export async function startClassificationRunAction(formData: FormData): Promise<void> {
  await requireAdminUser();

  const raw = String(formData.get("limit") ?? "50");
  const limit = ALLOWED_LIMITS.has(raw) ? raw : "50";
  const started = startClassificationRun(limit === "all" ? null : Number(limit));

  revalidatePath("/admin/classificacao");
  redirect(started ? "/admin/classificacao" : "/admin/classificacao?busy=1");
}

export async function stopClassificationRunAction(): Promise<void> {
  await requireAdminUser();

  stopClassificationRun();

  revalidatePath("/admin/classificacao");
  redirect("/admin/classificacao");
}
