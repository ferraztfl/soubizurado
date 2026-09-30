"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { planOffer, type OfferError } from "@/modules/store/domain/store";
import { processMercadoPagoPayment } from "@/modules/store/infrastructure/process-payment";
import {
  InvalidImageError,
  isFilledFile,
  prepareUploadedImage,
  uploadPreparedImage,
} from "@/modules/question-bank/infrastructure/uploaded-question-image";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const errorMessages: Readonly<Record<OfferError | "SLUG_TAKEN", string>> = {
  NAME_REQUIRED: "Informe o nome da oferta (3 a 160 caracteres).",
  SLUG_INVALID: "O endereço (slug) aceita só letras minúsculas, números e hífens.",
  PRICE_INVALID: "Informe um preço válido (mínimo R$ 1,00).",
  COMPARE_AT_INVALID: "O preço \"de\" precisa ser maior que o preço de venda.",
  PROMO_END_INVALID: "Fim da promoção: informe uma data válida e o preço \"de\" (preço cheio que volta a valer depois).",
  GRANT_REQUIRED: "Informe quantos dias de Premium a oferta dá (0 = sem prazo).",
  TEXT_TOO_LONG: "Chamada ou descrição longa demais.",
  SLUG_TAKEN: "Já existe outra oferta com esse endereço (slug).",
};

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Stores an admin-uploaded banner (re-encoded as WebP) and returns its media asset id. */
async function storeBanner(file: File, alt: string): Promise<string> {
  const prepared = await prepareUploadedImage(file);
  const upload = await uploadPreparedImage(prepared);
  const asset = await getPrismaClient().mediaAsset.upsert({
    where: { checksum: prepared.checksum },
    update: {},
    create: {
      checksum: prepared.checksum,
      storageProvider: upload.provider,
      bucket: upload.bucket,
      storageKey: upload.storageKey,
      mimeType: prepared.mimeType,
      sizeBytes: BigInt(prepared.bytes.byteLength),
      width: prepared.width,
      height: prepared.height,
      altText: alt.slice(0, 500),
      sourceUrl: "admin-offer-banner",
    },
    select: { id: true },
  });
  return asset.id;
}

/** Creates or updates an offer (and replaces what it grants). Past orders keep their access. */
export async function saveOfferAction(formData: FormData): Promise<void> {
  await requireAdminUser();

  const offerId = readString(formData, "offerId");
  const editing = UUID.test(offerId);
  const back = editing ? `/admin/loja/${offerId}` : "/admin/loja";

  const result = planOffer({
    name: readString(formData, "name"),
    slug: readString(formData, "slug"),
    headline: readString(formData, "headline"),
    description: readString(formData, "description"),
    price: readString(formData, "price"),
    compareAt: readString(formData, "compareAt"),
    premiumDays: readString(formData, "premiumDays"),
    courseIds: formData.getAll("courseIds").filter((value): value is string => typeof value === "string" && UUID.test(value)),
    courseDays: readString(formData, "courseDays"),
    promoLastDay: readString(formData, "promoLastDay"),
  });

  if (!result.ok) {
    redirect(`${back}?error=${encodeURIComponent(errorMessages[result.error])}`);
  }

  const prisma = getPrismaClient();
  const { offer } = result;
  const taken = await prisma.offer.findUnique({ where: { slug: offer.slug }, select: { id: true } });
  const courseIds = offer.grants.flatMap((grant) => (grant.kind === "COURSE" ? [grant.courseId] : []));

  if (courseIds.length > 0 && (await prisma.course.count({ where: { id: { in: courseIds } } })) !== courseIds.length) {
    redirect(`${back}?error=${encodeURIComponent("Curso inválido na oferta.")}`);
  }

  if (taken && taken.id !== offerId) {
    redirect(`${back}?error=${encodeURIComponent(errorMessages.SLUG_TAKEN)}`);
  }

  const banner = formData.get("banner");
  let bannerAssetId: string | null | undefined;

  try {
    bannerAssetId = isFilledFile(banner) ? await storeBanner(banner, `Banner: ${offer.name}`) : formData.get("removeBanner") === "on" ? null : undefined;
  } catch (error) {
    if (error instanceof InvalidImageError) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
    throw error;
  }

  const sortOrder = Number(readString(formData, "sortOrder")) || 0;
  const data = {
    name: offer.name,
    slug: offer.slug,
    headline: offer.headline,
    description: offer.description,
    priceCents: offer.priceCents,
    compareAtCents: offer.compareAtCents,
    promoEndsAt: offer.promoEndsAt,
    isActive: formData.get("isActive") === "on",
    isFeatured: formData.get("isFeatured") === "on",
    sortOrder: Math.max(-1000, Math.min(1000, Math.trunc(sortOrder))),
    ...(bannerAssetId !== undefined ? { bannerAssetId } : {}),
  };

  const saved = await prisma.$transaction(async (transaction) => {
    const row = editing
      ? await transaction.offer.update({ where: { id: offerId }, data, select: { id: true } })
      : await transaction.offer.create({ data, select: { id: true } });

    await transaction.offerGrant.deleteMany({ where: { offerId: row.id } });
    await transaction.offerGrant.createMany({
      data: offer.grants.map((grant) => ({
        offerId: row.id,
        kind: grant.kind,
        courseId: grant.kind === "COURSE" ? grant.courseId : null,
        durationDays: grant.durationDays,
      })),
    });

    return row;
  });

  revalidatePath("/admin/loja");
  revalidatePath("/loja");
  revalidatePath("/");
  redirect(`/admin/loja/${saved.id}?ok=1`);
}

/** Re-checks a Mercado Pago payment by id (support: a buyer paid but the webhook did not arrive). */
export async function recheckPaymentAction(formData: FormData): Promise<void> {
  await requireAdminUser();

  const paymentId = readString(formData, "paymentId").trim();

  if (!/^\d{1,20}$/.test(paymentId)) {
    redirect(`/admin/loja?error=${encodeURIComponent("Informe o número do pagamento do Mercado Pago.")}`);
  }

  let message: string;

  try {
    const result = await processMercadoPagoPayment(paymentId);
    message =
      result.kind === "UNKNOWN_ORDER"
        ? "Pagamento encontrado, mas não é de um pedido desta loja."
        : result.kind === "AMOUNT_MISMATCH"
          ? "O valor pago não confere com o pedido — acesso não liberado."
          : `Pedido atualizado: ${result.status}${result.granted ? " (acesso liberado agora)" : ""}.`;
  } catch {
    message = "Não foi possível consultar o Mercado Pago (credenciais ou número do pagamento).";
  }

  revalidatePath("/admin/loja");
  redirect(`/admin/loja?info=${encodeURIComponent(message)}`);
}
