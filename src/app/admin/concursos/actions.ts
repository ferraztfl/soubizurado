"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { parsePositionLines, planContest, type ContestError } from "@/modules/contests/domain/contest";
import { storeContestLogo } from "@/modules/contests/infrastructure/contest-logo";
import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { InvalidImageError, isFilledFile } from "@/modules/question-bank/infrastructure/uploaded-question-image";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const errors: Readonly<Record<ContestError | "SLUG_TAKEN", string>> = {
  NAME_REQUIRED: "Informe o nome do concurso (3 a 200 caracteres).",
  SLUG_INVALID: "O endereço (slug) aceita só letras minúsculas, números e hífens.",
  ORGANIZATION_REQUIRED: "Informe o órgão.",
  STATUS_INVALID: "Situação inválida.",
  STATE_INVALID: "UF inválida.",
  VACANCIES_INVALID: "Número de vagas inválido (use só números, ex.: 1.200).",
  SALARY_INVALID: "Salário inválido (ex.: 5.197,50) ou mínimo maior que o máximo.",
  DATE_INVALID: "Data inválida.",
  REGISTRATION_ORDER: "O fim das inscrições não pode ser antes do início.",
  NOTICE_URL_INVALID: "O link do edital precisa ser um endereço https:// válido.",
  TEXT_TOO_LONG: "Cargos (até 1.000) ou resumo longos demais.",
  SLUG_TAKEN: "Já existe outro concurso com esse endereço (slug).",
};

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

function revalidatePublic(slug?: string) {
  revalidatePath("/admin/concursos");
  revalidatePath("/concursos");
  if (slug) revalidatePath(`/concursos/${slug}`);
  revalidatePath("/");
}

/** Creates or updates a contest. Facts are typed by the team from the official notice. */
export async function saveContestAction(formData: FormData): Promise<void> {
  await requireAdminUser();

  const contestId = readId(formData, "contestId");
  const back = contestId ? `/admin/concursos/${contestId}` : "/admin/concursos/novo";

  const result = planContest({
    name: readString(formData, "name"),
    slug: readString(formData, "slug"),
    organizationName: readString(formData, "organizationName"),
    stateCode: readString(formData, "stateCode"),
    status: readString(formData, "status"),
    vacancies: readString(formData, "vacancies"),
    hasReserveList: formData.get("hasReserveList") === "on",
    salaryMin: readString(formData, "salaryMin"),
    salaryMax: readString(formData, "salaryMax"),
    educationLevels: formData.getAll("educationLevels").filter((value): value is string => typeof value === "string"),
    positions: readString(formData, "positions"),
    summary: readString(formData, "summary"),
    registrationStart: readString(formData, "registrationStart"),
    registrationEnd: readString(formData, "registrationEnd"),
    examDate: readString(formData, "examDate"),
    noticeUrl: readString(formData, "noticeUrl"),
    isFeatured: formData.get("isFeatured") === "on",
    isPublished: formData.get("isPublished") === "on",
  });

  if (!result.ok) fail(back, errors[result.error]);

  const { contest } = result;

  const positionLines = parsePositionLines(readString(formData, "positionLines"));
  if (!positionLines.ok) fail(back, `Cargos: confira a linha ${positionLines.line} (formato: Cargo | vagas | salário | escolaridade | requisitos).`);

  const optionalText = (key: string, max: number) => {
    const value = readString(formData, key).trim().replace(/[ \t]+/g, " ");
    return value ? value.slice(0, max) : null;
  };
  const details = {
    feeText: optionalText("feeText", 120),
    examLocations: optionalText("examLocations", 300),
    authorization: optionalText("authorization", 300),
    stages: readString(formData, "stages").trim().slice(0, 2000),
  };

  const prisma = getPrismaClient();
  const taken = await prisma.contest.findUnique({ where: { slug: contest.slug }, select: { id: true } });
  if (taken && taken.id !== contestId) fail(back, errors.SLUG_TAKEN);

  // Link to the question bank's organization when the name matches one (for "questões do órgão").
  const organization = await prisma.publicOrganization.findFirst({
    where: { name: { equals: contest.organizationName, mode: "insensitive" }, isActive: true },
    select: { id: true },
  });

  const boardId = readId(formData, "boardId");
  const careerCategoryId = readId(formData, "careerCategoryId");
  const relatedOfferId = readId(formData, "relatedOfferId");
  const [board, category, offer] = await Promise.all([
    boardId ? prisma.examiningBoard.findFirst({ where: { id: boardId, isActive: true }, select: { id: true } }) : null,
    careerCategoryId
      ? prisma.blogCategory.findFirst({ where: { id: careerCategoryId, groupKey: { in: ["CARREIRA", "EXAME"] } }, select: { id: true } })
      : null,
    relatedOfferId ? prisma.offer.findUnique({ where: { id: relatedOfferId }, select: { id: true } }) : null,
  ]);

  const logo = formData.get("logo");
  let logoAssetId: string | null | undefined;
  try {
    logoAssetId = isFilledFile(logo)
      ? await storeContestLogo(logo, contest.organizationName)
      : formData.get("removeLogo") === "on"
        ? null
        : undefined;
  } catch (error) {
    if (error instanceof InvalidImageError) fail(back, error.message);
    throw error;
  }

  const data = {
    ...contest,
    ...details,
    ...(logoAssetId !== undefined ? { logoAssetId } : {}),
    organizationId: organization?.id ?? null,
    boardId: board?.id ?? null,
    careerCategoryId: category?.id ?? null,
    relatedOfferId: offer?.id ?? null,
  };

  const previous = contestId ? await prisma.contest.findUnique({ where: { id: contestId }, select: { slug: true } }) : null;
  if (contestId && !previous) fail("/admin/concursos", "Concurso não encontrado.");

  // The positions are replaced as a whole on every save.
  const saved = await prisma.$transaction(async (transaction) => {
    const row = contestId
      ? await transaction.contest.update({ where: { id: contestId }, data, select: { id: true } })
      : await transaction.contest.create({ data, select: { id: true } });
    await transaction.contestPosition.deleteMany({ where: { contestId: row.id } });
    if (positionLines.positions.length > 0) {
      await transaction.contestPosition.createMany({
        data: positionLines.positions.map((position, index) => ({ ...position, contestId: row.id, sortOrder: index })),
      });
    }
    return row;
  });

  if (previous && previous.slug !== contest.slug) revalidatePath(`/concursos/${previous.slug}`);
  revalidatePublic(contest.slug);
  redirect(`/admin/concursos/${saved.id}?ok=1`);
}

export async function deleteContestAction(formData: FormData): Promise<void> {
  await requireAdminUser();

  const contestId = readId(formData, "contestId");
  if (!contestId) fail("/admin/concursos", "Concurso inválido.");
  if (formData.get("confirm") !== "on") fail(`/admin/concursos/${contestId}`, "Marque a confirmação para excluir o concurso.");

  const deleted = await getPrismaClient().contest.delete({ where: { id: contestId }, select: { slug: true } });

  revalidatePublic(deleted.slug);
  redirect("/admin/concursos?ok=excluido");
}
