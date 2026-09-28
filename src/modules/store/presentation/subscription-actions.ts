"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ensureProfileForAuthUser } from "@/modules/identity/application/ensure-profile";
import { DEFAULT_SUBSCRIPTION_PLAN, SUBSCRIPTION_PLANS } from "@/modules/store/domain/subscription";
import {
  cancelPreapproval,
  createPreapproval,
  isMercadoPagoConfigured,
} from "@/modules/store/infrastructure/mercado-pago/mercado-pago-client";
import { syncMercadoPagoSubscription } from "@/modules/store/infrastructure/process-subscription";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";

/*
 * Premium mensal (Mercado Pago Assinaturas). The price comes from the plan
 * on the server; the subscriber authorizes the recurring charge on Mercado
 * Pago. Access starts with the first approved charge (webhook / return page).
 */

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

function back(error: string): never {
  redirect(`/assinatura?erro=${error}`);
}

const termsSchema = z.literal("on");

async function startSubscription(profileId: string, payerEmail: string): Promise<never> {
  const prisma = getPrismaClient();

  const active = await prisma.subscription.findFirst({
    where: { profileId, status: { in: ["AUTHORIZED", "PAUSED"] } },
    select: { id: true },
  });
  if (active) redirect("/app/assinatura");

  const planKey = DEFAULT_SUBSCRIPTION_PLAN;
  const plan = SUBSCRIPTION_PLANS[planKey];
  const subscription = await prisma.subscription.create({
    data: { profileId, planKey, amountCents: plan.amountCents },
    select: { id: true },
  });

  let checkoutUrl: string;

  try {
    const preapproval = await createPreapproval({
      subscriptionId: subscription.id,
      reason: plan.reason,
      payerEmail,
      amountCents: plan.amountCents,
      frequencyMonths: plan.frequencyMonths,
      backUrl: `${siteUrl()}/assinatura/retorno`,
    });

    if (!preapproval.init_point) throw new Error("Mercado Pago did not return init_point.");

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { providerSubscriptionId: preapproval.id, providerStatus: preapproval.status.slice(0, 40) },
    });
    checkoutUrl = preapproval.init_point;
  } catch {
    await prisma.subscription.update({ where: { id: subscription.id }, data: { status: "CANCELLED", providerStatus: "create_error" } });
    back("pagamento");
  }

  redirect(checkoutUrl);
}

/** Signed-in student: one click. */
export async function subscribeAction(formData: FormData): Promise<void> {
  if (!termsSchema.safeParse(formData.get("acceptTerms")).success) back("termos");
  if (!isMercadoPagoConfigured()) back("configuracao");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) back("sessao");

  const displayName = typeof user.user_metadata.display_name === "string" ? user.user_metadata.display_name : null;
  const profile = await ensureProfileForAuthUser({ authUserId: user.id, displayName });

  await startSubscription(profile.id, user.email);
}

const newAccountSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  email: z.email().trim().toLowerCase().max(254),
  password: z.string().min(8).max(128),
});

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Visitor: creates the account and goes on to subscribe. */
export async function subscribeNewAccountAction(formData: FormData): Promise<void> {
  if (!termsSchema.safeParse(formData.get("acceptTerms")).success) back("termos");
  if (!isMercadoPagoConfigured()) back("configuracao");

  const parsed = newAccountSchema.safeParse({
    displayName: readString(formData, "displayName"),
    email: readString(formData, "email"),
    password: readString(formData, "password"),
  });
  if (!parsed.success) back("dados");

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
  if (error || !data.user || (data.user.identities?.length ?? 0) === 0) back("conta-existe");

  const profile = await ensureProfileForAuthUser({ authUserId: data.user.id, displayName: parsed.data.displayName });

  await startSubscription(profile.id, parsed.data.email);
}

/** Stops future charges; the Premium already paid stays until its end. */
export async function cancelSubscriptionAction(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (formData.get("confirm") !== "on") redirect("/app/assinatura?erro=confirmacao");

  const prisma = getPrismaClient();
  const profile = await prisma.profile.findUnique({ where: { authUserId: user.id }, select: { id: true } });
  const subscriptionId = readString(formData, "subscriptionId");

  // Only the owner's own subscription (never trust the id alone).
  const subscription = profile
    ? await prisma.subscription.findFirst({
        where: { id: subscriptionId, profileId: profile.id, status: { in: ["AUTHORIZED", "PAUSED", "PENDING"] } },
        select: { id: true, providerSubscriptionId: true },
      })
    : null;

  if (!subscription) redirect("/app/assinatura?erro=assinatura");

  try {
    if (subscription.providerSubscriptionId) {
      await cancelPreapproval(subscription.providerSubscriptionId);
      await syncMercadoPagoSubscription(subscription.providerSubscriptionId);
    } else {
      await prisma.subscription.update({ where: { id: subscription.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    }
  } catch {
    redirect("/app/assinatura?erro=cancelamento");
  }

  revalidatePath("/app", "layout");
  redirect("/app/assinatura?ok=cancelada");
}
