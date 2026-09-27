import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

/*
 * Read-only: how the current student did on a page of questions, for the
 * "Resolvida / Acertou / Errou" marks of the question list. Looks the
 * profile up by auth user id and never creates it (answering does).
 */

export type AnsweredQuestionStatus = Readonly<{
  attempts: number;
  lastIsCorrect: boolean;
}>;

export async function loadAnsweredQuestionStatus(
  authUserId: string,
  questionIds: readonly string[],
): Promise<ReadonlyMap<string, AnsweredQuestionStatus>> {
  if (questionIds.length === 0) {
    return new Map();
  }

  const prisma = getPrismaClient();
  const profile = await prisma.profile.findUnique({ where: { authUserId }, select: { id: true } });

  if (!profile) {
    return new Map();
  }

  const attempts = await prisma.studyAnswerAttempt.findMany({
    where: { profileId: profile.id, questionId: { in: [...questionIds] } },
    orderBy: { answeredAt: "desc" },
    select: { questionId: true, isCorrect: true },
  });

  const status = new Map<string, AnsweredQuestionStatus>();

  // Ordered newest first: the first attempt seen is the latest one.
  for (const attempt of attempts) {
    const current = status.get(attempt.questionId);
    status.set(attempt.questionId, {
      attempts: (current?.attempts ?? 0) + 1,
      lastIsCorrect: current ? current.lastIsCorrect : attempt.isCorrect,
    });
  }

  return status;
}
