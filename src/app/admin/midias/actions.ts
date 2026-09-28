"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

const retrySchema = z.object({
  taskId: z.union([z.uuid(), z.literal("all")]),
});

function back(query: string): never {
  redirect(`/admin/midias?${query}`);
}

/**
 * Puts failed media downloads back in the queue (one, or every failed
 * one). Nothing is downloaded here: the queue worker (`npm run
 * media:process`) picks them up on its next run.
 */
export async function retryMediaTaskAction(formData: FormData): Promise<void> {
  await requireAdminUser();

  const parsed = retrySchema.safeParse({ taskId: formData.get("taskId") ?? "" });

  if (!parsed.success) {
    back(`error=${encodeURIComponent("Tarefa inválida.")}`);
  }

  const result = await getPrismaClient().importMediaTask.updateMany({
    where: { status: "FAILED", ...(parsed.data.taskId === "all" ? {} : { id: parsed.data.taskId }) },
    data: { status: "PENDING", attempts: 0, errorMessage: null, nextAttemptAt: null },
  });

  revalidatePath("/admin/midias");
  back(`retried=${result.count}`);
}
