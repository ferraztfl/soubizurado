import { answerAllowance, type AnswerAllowance } from "@/modules/study/domain/access";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import { todayInSaoPaulo } from "./study-preferences";

/** Midnight of a São Paulo day as an instant (UTC−3, no DST since 2019). */
const startOfLocalDay = (day: string) => new Date(`${day}T03:00:00Z`);

/** Active premium question-bank access (any source: admin, order, subscription). */
export async function hasPremiumAccess(profileId: string, now = new Date()): Promise<boolean> {
  const prisma = getPrismaClient();
  const [active, admin] = await Promise.all([
    prisma.entitlement.findFirst({
      where: {
        profileId,
        kind: "QUESTION_BANK",
        revokedAt: null,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      select: { id: true },
    }),
    // Staff reviewing questions never hit the free limit.
    prisma.userRole.findUnique({ where: { profileId_role: { profileId, role: "ADMIN" } }, select: { id: true } }),
  ]);

  return active !== null || admin !== null;
}

/** Plan and today's answers of a signed-in student. */
export async function loadAnswerAllowance(profileId: string, now = new Date()): Promise<AnswerAllowance> {
  const [premium, used] = await Promise.all([
    hasPremiumAccess(profileId, now),
    getPrismaClient().studyAnswerAttempt.count({
      where: { profileId, answeredAt: { gte: startOfLocalDay(todayInSaoPaulo(now)) } },
    }),
  ]);

  return answerAllowance(premium ? "premium" : "free", used);
}
