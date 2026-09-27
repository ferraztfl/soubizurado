import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

/*
 * Read-only helpers for the question explorer: the student's profile id (for
 * the "Minhas questões" filter) and how they did on a page of questions (the
 * "Resolvida / Acertou / Errou" marks). Never creates the profile — answering
 * does.
 */

export type AnsweredQuestionStatus = Readonly<{
  attempts: number;
  lastIsCorrect: boolean;
}>;

export async function findStudentProfileId(authUserId: string): Promise<string | null> {
  const profile = await getPrismaClient().profile.findUnique({
    where: { authUserId },
    select: { id: true },
  });

  return profile?.id ?? null;
}

export async function loadAnsweredQuestionStatus(
  profileId: string,
  questionIds: readonly string[],
): Promise<ReadonlyMap<string, AnsweredQuestionStatus>> {
  if (questionIds.length === 0) {
    return new Map();
  }

  const attempts = await getPrismaClient().studyAnswerAttempt.findMany({
    where: { profileId, questionId: { in: [...questionIds] } },
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
