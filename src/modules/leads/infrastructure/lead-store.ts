import { createHmac } from "node:crypto";

import { headers } from "next/headers";

import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import { LEADS_PER_HOUR, type LeadPlan } from "../domain/lead";

/*
 * Storage of leads. The requester IP is kept only as an HMAC (abuse limit).
 * One row per e-mail and material: asking again updates the contact data and
 * never removes a marketing consent already given (only the person can, by
 * unsubscribing).
 */

function secret(): string {
  return process.env.VISITOR_HASH_SECRET || process.env.SUPABASE_SECRET_KEY || "soubizurado-dev-visitor-secret";
}

async function requesterHash(): Promise<string | null> {
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || headerStore.get("x-real-ip")?.trim() || null;
  return ip ? createHmac("sha256", secret()).update(`lead-ip:${ip}`).digest("hex") : null;
}

export type SaveLeadResult = Readonly<{ ok: true; leadId: string }> | Readonly<{ ok: false; reason: "RATE_LIMITED" | "NOT_FOUND" }>;

/** Registers a request for the edital verticalizado PDF of a published syllabus. */
export async function saveSyllabusLead(lead: LeadPlan, syllabusId: string, now = new Date()): Promise<SaveLeadResult> {
  const prisma = getPrismaClient();
  const syllabus = await prisma.contestSyllabus.findFirst({
    where: { id: syllabusId, isPublished: true, contest: { isPublished: true } },
    select: { id: true, title: true, contest: { select: { name: true } } },
  });
  if (!syllabus) return { ok: false, reason: "NOT_FOUND" };

  const ipHash = await requesterHash();
  if (ipHash) {
    const recent = await prisma.lead.count({ where: { ipHash, createdAt: { gt: new Date(now.getTime() - 60 * 60 * 1000) } } });
    if (recent >= LEADS_PER_HOUR) return { ok: false, reason: "RATE_LIMITED" };
  }

  const consent = lead.marketingConsent ? { marketingConsent: true, marketingConsentAt: now, unsubscribedAt: null } : {};
  const saved = await prisma.lead.upsert({
    where: { email_syllabusId: { email: lead.email, syllabusId: syllabus.id } },
    create: {
      name: lead.name,
      email: lead.email,
      whatsapp: lead.whatsapp,
      syllabusId: syllabus.id,
      sourceLabel: `${syllabus.contest.name} – ${syllabus.title}`.slice(0, 240),
      ipHash,
      ...consent,
    },
    update: { name: lead.name, whatsapp: lead.whatsapp, ...consent },
    select: { id: true },
  });
  return { ok: true, leadId: saved.id };
}
