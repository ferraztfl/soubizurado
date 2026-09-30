"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { ensureProfileForAuthUser } from "@/modules/identity/application/ensure-profile";
import { effectiveOfferPrice } from "@/modules/store/domain/offer-price";
import {
  createPreference,
  isMercadoPagoConfigured,
} from "@/modules/store/infrastructure/mercado-pago/mercado-pago-client";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";

/*
 * Store checkout (Mercado Pago Checkout Pro). A signed-in student buys in
 * one click; a visitor creates the account in the same step. The order is
 * created PENDING with the offer's current price; access is granted only
 * when the payment is confirmed through the API (webhook / return page).
 */

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function back(slug: string, error: string): never {
  redirect(`/loja/${SLUG.test(slug) ? slug : ""}?erro=${error}`);
}

/** Creates the order and the Mercado Pago preference, then sends the buyer to pay. */
async function startPayment(
  profileId: string,
  slug: string,
  payer: Readonly<{ email: string | null; name: string | null }>,
): Promise<never> {
  const prisma = getPrismaClient();
  const offer = await prisma.offer.findFirst({
    where: { slug, isActive: true },
    select: {
      id: true,
      name: true,
      headline: true,
      priceCents: true,
      compareAtCents: true,
      promoEndsAt: true,
      grants: { select: { kind: true, durationDays: true } },
    },
  });

  if (!offer) {
    back(slug, "indisponivel");
  }

  // Charged price decided here (server): a promotion past its end date sells at the regular price.
  const { priceCents } = effectiveOfferPrice(offer, new Date());

  const order = await prisma.order.create({
    data: {
      profileId,
      offerId: offer.id,
      amountCents: priceCents,
      offerSnapshot: { name: offer.name, priceCents, grants: offer.grants },
    },
    select: { id: true },
  });

  let checkoutUrl: string;

  try {
    const preference = await createPreference({
      orderId: order.id,
      title: offer.name,
      description: offer.headline,
      priceCents,
      payerEmail: payer.email,
      payerName: payer.name,
      siteUrl: siteUrl(),
    });

    await prisma.order.update({ where: { id: order.id }, data: { providerPreferenceId: preference.id } });

    const testMode = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim().startsWith("TEST-");
    checkoutUrl = (testMode ? preference.sandbox_init_point : null) ?? preference.init_point;
  } catch {
    await prisma.order.update({ where: { id: order.id }, data: { status: "FAILED", providerStatus: "preference_error" } });
    back(slug, "pagamento");
  }

  redirect(checkoutUrl);
}

const termsSchema = z.literal("on");

/** Signed-in buyer: one click. */
export async function checkoutAction(formData: FormData): Promise<void> {
  const slug = readString(formData, "offer");

  if (!SLUG.test(slug)) back(slug, "indisponivel");
  if (!termsSchema.safeParse(formData.get("acceptTerms")).success) back(slug, "termos");
  if (!isMercadoPagoConfigured()) back(slug, "configuracao");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    back(slug, "sessao");
  }

  const displayName = typeof user.user_metadata.display_name === "string" ? user.user_metadata.display_name : null;
  const profile = await ensureProfileForAuthUser({ authUserId: user.id, displayName });

  await startPayment(profile.id, slug, { email: user.email ?? null, name: displayName });
}

const newAccountSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  email: z.email().trim().toLowerCase().max(254),
  password: z.string().min(8).max(128),
});

/** Visitor: creates the account (Supabase sign-up) and goes on to pay. */
export async function checkoutNewAccountAction(formData: FormData): Promise<void> {
  const slug = readString(formData, "offer");

  if (!SLUG.test(slug)) back(slug, "indisponivel");
  if (!termsSchema.safeParse(formData.get("acceptTerms")).success) back(slug, "termos");
  if (!isMercadoPagoConfigured()) back(slug, "configuracao");

  const parsed = newAccountSchema.safeParse({
    displayName: readString(formData, "displayName"),
    email: readString(formData, "email"),
    password: readString(formData, "password"),
  });

  if (!parsed.success) {
    back(slug, "dados");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/confirm`,
      data: { display_name: parsed.data.displayName },
    },
  });

  // With e-mail confirmation on, an existing address comes back without identities.
  if (error || !data.user || (data.user.identities?.length ?? 0) === 0) {
    back(slug, "conta-existe");
  }

  const profile = await ensureProfileForAuthUser({ authUserId: data.user.id, displayName: parsed.data.displayName });

  await startPayment(profile.id, slug, { email: parsed.data.email, name: parsed.data.displayName });
}
