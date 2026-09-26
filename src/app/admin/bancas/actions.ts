"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { examiningBoardSlug } from "@/modules/question-bank/domain/examining-board-catalog";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

const optionalUrl = z
  .string()
  .trim()
  .max(300, "Endereço longo demais.")
  .refine((value) => value === "" || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(value), "Informe um site válido (https://...).")
  .transform((value) => value || null);

const createSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da banca.").max(120, "Nome longo demais."),
  acronym: z.string().trim().max(40, "Sigla longa demais.").transform((value) => value || null),
  websiteUrl: optionalUrl,
});

const updateSchema = z.object({
  id: z.string().uuid(),
  acronym: z.string().trim().max(40, "Sigla longa demais.").transform((value) => value || null),
  websiteUrl: optionalUrl,
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});

function back(query: string): never {
  redirect(`/admin/bancas?${query}`);
}

function errorQuery(message: string): string {
  return `error=${encodeURIComponent(message)}`;
}

/**
 * The name is fixed after creation: importers identify a board by the
 * slug of its name, so renaming would create a duplicate on the next
 * import. A misspelled board is deactivated and created again.
 */
export async function createExaminingBoardAction(formData: FormData): Promise<void> {
  await requireAdminUser();

  const parsed = createSchema.safeParse({
    name: formData.get("name") ?? "",
    acronym: formData.get("acronym") ?? "",
    websiteUrl: formData.get("websiteUrl") ?? "",
  });

  if (!parsed.success) {
    back(errorQuery(parsed.error.issues[0]?.message ?? "Dados inválidos."));
  }

  const slug = examiningBoardSlug(parsed.data.name);

  if (!slug) {
    back(errorQuery("O nome precisa conter letras ou números."));
  }

  const prisma = getPrismaClient();
  const existing = await prisma.examiningBoard.findUnique({ where: { slug }, select: { name: true } });

  if (existing) {
    back(errorQuery(`Já existe a banca "${existing.name}" com esse nome.`));
  }

  await prisma.examiningBoard.create({
    data: {
      name: parsed.data.name,
      acronym: parsed.data.acronym,
      websiteUrl: parsed.data.websiteUrl,
      slug,
    },
  });

  revalidatePath("/admin/bancas");
  back(`saved=${encodeURIComponent(parsed.data.name)}`);
}

export async function updateExaminingBoardAction(formData: FormData): Promise<void> {
  await requireAdminUser();

  const parsed = updateSchema.safeParse({
    id: formData.get("id") ?? "",
    acronym: formData.get("acronym") ?? "",
    websiteUrl: formData.get("websiteUrl") ?? "",
    isActive: formData.get("isActive") ?? "true",
  });

  if (!parsed.success) {
    back(errorQuery(parsed.error.issues[0]?.message ?? "Dados inválidos."));
  }

  const prisma = getPrismaClient();
  const board = await prisma.examiningBoard.findUnique({
    where: { id: parsed.data.id },
    select: { name: true },
  });

  if (!board) {
    back(errorQuery("Banca não encontrada."));
  }

  await prisma.examiningBoard.update({
    where: { id: parsed.data.id },
    data: {
      acronym: parsed.data.acronym,
      websiteUrl: parsed.data.websiteUrl,
      isActive: parsed.data.isActive,
    },
  });

  revalidatePath("/admin/bancas");
  revalidatePath("/app/questoes");
  back(`saved=${encodeURIComponent(board.name)}`);
}
