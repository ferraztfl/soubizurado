"use server";

import { planLead, type LeadError } from "@/modules/leads/domain/lead";
import { saveSyllabusLead } from "@/modules/leads/infrastructure/lead-store";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SyllabusPdfState = Readonly<{ status: "idle" | "ok" | "error"; message: string | null; downloadUrl: string | null }>;

const errors: Readonly<Record<LeadError, string>> = {
  NAME_INVALID: "Informe seu nome e sobrenome.",
  EMAIL_INVALID: "Informe um e-mail válido.",
  WHATSAPP_INVALID: "Informe um WhatsApp válido com DDD (ex.: 81 99999-0000).",
};

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Registers the request and answers with the download link of the edital verticalizado PDF. */
export async function requestSyllabusPdfAction(_previous: SyllabusPdfState, formData: FormData): Promise<SyllabusPdfState> {
  const fail = (message: string): SyllabusPdfState => ({ status: "error", message, downloadUrl: null });

  // Honeypot: people never fill this hidden field.
  if (readString(formData, "empresa").trim() !== "") return fail("Não foi possível concluir. Tente novamente.");

  const syllabusId = readString(formData, "syllabusId");
  if (!UUID.test(syllabusId)) return fail("Edital não encontrado.");
  if (formData.get("privacy") !== "on") return fail("Marque que leu a Política de privacidade para continuar.");

  const plan = planLead({
    name: readString(formData, "name"),
    email: readString(formData, "email"),
    whatsapp: readString(formData, "whatsapp"),
    marketingConsent: formData.get("marketing") === "on",
  });
  if (!plan.ok) return fail(errors[plan.error]);

  const saved = await saveSyllabusLead(plan.lead, syllabusId);
  if (!saved.ok) {
    return fail(saved.reason === "RATE_LIMITED" ? "Muitos pedidos em pouco tempo. Tente de novo mais tarde." : "Edital não encontrado.");
  }

  return { status: "ok", message: "Pronto! Seu edital verticalizado está liberado.", downloadUrl: `/api/edital-verticalizado/${saved.leadId}` };
}
