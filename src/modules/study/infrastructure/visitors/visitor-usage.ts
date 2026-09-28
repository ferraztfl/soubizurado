import { createHmac, randomUUID } from "node:crypto";

import { cookies, headers } from "next/headers";

import { answerAllowance, type AnswerAllowance } from "@/modules/study/domain/access";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import { todayInSaoPaulo } from "../queries/study-preferences";

/*
 * Signed-out visitors: 1 answer per São Paulo day, counted by a random
 * cookie id AND by the IP (clearing cookies alone does not reset it).
 * Only HMAC hashes are stored — never the IP or the raw cookie.
 */

export const VISITOR_COOKIE = "sb_visitante";
const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function secret(): string {
  return process.env.VISITOR_HASH_SECRET || process.env.SUPABASE_SECRET_KEY || "soubizurado-dev-visitor-secret";
}

function hash(kind: string, value: string): string {
  return createHmac("sha256", secret()).update(`${kind}:${value}`).digest("hex");
}

async function clientIp(): Promise<string | null> {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();

  return forwarded || headerStore.get("x-real-ip")?.trim() || null;
}

async function visitorKeys(cookieId: string | null): Promise<string[]> {
  const ip = await clientIp();

  return [...(cookieId ? [hash("cookie", cookieId)] : []), ...(ip ? [hash("ip", ip)] : [])];
}

const dayDate = (day: string) => new Date(`${day}T00:00:00Z`);

/** Today's allowance of the current visitor (read-only; usable in layouts). */
export async function loadVisitorAllowance(): Promise<AnswerAllowance> {
  const cookieId = (await cookies()).get(VISITOR_COOKIE)?.value ?? null;
  const keys = await visitorKeys(cookieId);

  if (keys.length === 0) {
    return answerAllowance("visitor", 0);
  }

  const rows = await getPrismaClient().visitorAnswerUsage.findMany({
    where: { keyHash: { in: keys }, day: dayDate(todayInSaoPaulo()) },
    select: { answers: true },
  });

  return answerAllowance("visitor", Math.max(0, ...rows.map((row) => row.answers)));
}

/**
 * Counts one visitor answer (server actions only: may set the cookie).
 * Returns false when the day's free answer was already used.
 */
export async function consumeVisitorAnswer(): Promise<{ allowed: boolean; allowance: AnswerAllowance }> {
  const cookieStore = await cookies();
  let cookieId = cookieStore.get(VISITOR_COOKIE)?.value ?? null;

  if (!cookieId || !/^[0-9a-f-]{36}$/i.test(cookieId)) {
    cookieId = randomUUID();
    cookieStore.set(VISITOR_COOKIE, cookieId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: VISITOR_COOKIE_MAX_AGE,
    });
  }

  const allowance = await loadVisitorAllowance();

  if (!allowance.canAnswer) {
    return { allowed: false, allowance };
  }

  const day = dayDate(todayInSaoPaulo());
  const prisma = getPrismaClient();

  for (const keyHash of await visitorKeys(cookieId)) {
    await prisma.visitorAnswerUsage.upsert({
      where: { keyHash_day: { keyHash, day } },
      update: { answers: { increment: 1 } },
      create: { keyHash, day, answers: 1 },
    });
  }

  return { allowed: true, allowance: answerAllowance("visitor", allowance.used + 1) };
}
