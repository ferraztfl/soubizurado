"use server";

import { z } from "zod";

import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

export type NewsletterState = Readonly<{ status: "idle" | "ok" | "error"; message: string | null }>;

const schema = z.object({
  email: z.email().trim().toLowerCase().max(254),
  consent: z.literal("on"),
});

/**
 * Blog newsletter sign-up. Needs explicit consent (LGPD). The answer is the
 * same whether the address was new or already there, so the form cannot be
 * used to find out who is subscribed.
 */
export async function subscribeNewsletterAction(_previous: NewsletterState, formData: FormData): Promise<NewsletterState> {
  const parsed = schema.safeParse({ email: formData.get("email") ?? "", consent: formData.get("consent") ?? "" });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues.some((issue) => issue.path[0] === "consent")
        ? "Marque a autorização para receber os e-mails."
        : "Informe um e-mail válido.",
    };
  }

  await getPrismaClient().newsletterSubscriber.upsert({
    where: { email: parsed.data.email },
    update: { unsubscribedAt: null, consentAt: new Date() },
    create: { email: parsed.data.email, source: formData.get("source") === "home" ? "home" : "blog" },
  });

  return { status: "ok", message: "Pronto! Você vai receber as novidades de concursos no seu e-mail." };
}
