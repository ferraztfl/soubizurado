"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  startClassificationRun,
  stopClassificationRun,
} from "@/modules/classification/infrastructure/classification-run-manager";
import { requireAdminUser } from "@/modules/identity/application/require-admin-user";

export async function startClassificationRunAction(): Promise<void> {
  await requireAdminUser();

  const started = startClassificationRun();

  revalidatePath("/admin/classificacao");
  redirect(started ? "/admin/classificacao" : "/admin/classificacao?busy=1");
}

export async function stopClassificationRunAction(): Promise<void> {
  await requireAdminUser();

  stopClassificationRun();

  revalidatePath("/admin/classificacao");
  redirect("/admin/classificacao");
}
