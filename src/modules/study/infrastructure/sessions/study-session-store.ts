import type { Prisma } from "@/generated/prisma/client";
import type { PublicQuestionReadFilters } from "@/modules/question-bank/application/ports/public-question-read-repository";
import { PrismaPublicQuestionReadRepository } from "@/modules/question-bank/infrastructure/repositories/prisma-public-question-read-repository";
import {
  firstPending,
  splitSession,
  type SessionQuestionResult,
  type StudySessionMode,
} from "@/modules/study/domain/study-session";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

/*
 * Persistence of guided study sessions. Every function takes the owner's
 * profile id and only touches that profile's sessions. A session question
 * counts as answered when the student answered it after the session started
 * (answers are recorded by the regular answer flow, which also moves the
 * spaced review queue).
 */

/** due_on is a DATE: due today or earlier = on or before today's date. */
function dueWhere(
  profileId: string,
  today: string,
  disciplineId: string | null,
  areaId: string | null = null,
): Prisma.StudyReviewItemWhereInput {
  return {
    profileId,
    dueOn: { lte: new Date(`${today}T00:00:00Z`) },
    question: { status: "PUBLISHED", ...(disciplineId ? { disciplineId } : {}), ...(areaId ? { areaId } : {}) },
  };
}

export async function countDueReviews(
  profileId: string,
  today: string,
  disciplineId: string | null = null,
  areaId: string | null = null,
): Promise<number> {
  return getPrismaClient().studyReviewItem.count({ where: dueWhere(profileId, today, disciplineId, areaId) });
}

export async function createStudySession(
  input: Readonly<{
    profileId: string;
    mode: StudySessionMode;
    size: number;
    today: string;
    title: string;
    disciplineId: string | null;
    areaId: string | null;
    filtersForDisplay: Prisma.InputJsonValue;
  }>,
): Promise<{ id: string } | null> {
  const prisma = getPrismaClient();
  const due = await countDueReviews(input.profileId, input.today, input.disciplineId, input.areaId);
  const split = splitSession(input.mode, input.size, due);

  const reviews =
    split.reviews > 0
      ? (
          await prisma.studyReviewItem.findMany({
            where: dueWhere(input.profileId, input.today, input.disciplineId, input.areaId),
            orderBy: [{ dueOn: "asc" }, { lapses: "desc" }],
            take: split.reviews,
            select: { questionId: true },
          })
        ).map((row) => row.questionId)
      : [];

  const filters: PublicQuestionReadFilters = {
    ...(input.disciplineId ? { disciplineId: input.disciplineId } : {}),
    ...(input.areaId ? { areaId: input.areaId } : {}),
    answered: { profileId: input.profileId, status: "unanswered" },
  };
  const fresh =
    split.fresh + (split.reviews - reviews.length) > 0 && input.mode !== "REVIEW"
      ? await new PrismaPublicQuestionReadRepository().drawPublishedIds(filters, split.fresh + (split.reviews - reviews.length))
      : [];

  const questionIds = [...new Set([...reviews, ...fresh])];

  if (questionIds.length === 0) {
    return null;
  }

  const session = await prisma.studySession.create({
    data: {
      profileId: input.profileId,
      mode: input.mode,
      title: input.title.slice(0, 160),
      filters: input.filtersForDisplay,
      questionCount: questionIds.length,
      questions: { create: questionIds.map((questionId, position) => ({ questionId, position })) },
    },
    select: { id: true },
  });

  return session;
}

export type StudySessionView = Readonly<{
  id: string;
  mode: string;
  title: string;
  status: string;
  startedAt: Date;
  questionIds: readonly string[];
  results: readonly SessionQuestionResult[];
  resumeAt: number | null;
}>;

async function resultsFor(profileId: string, startedAt: Date, questionIds: readonly string[]): Promise<SessionQuestionResult[]> {
  const attempts = await getPrismaClient().studyAnswerAttempt.findMany({
    where: { profileId, questionId: { in: [...questionIds] }, answeredAt: { gte: startedAt } },
    orderBy: { answeredAt: "asc" },
    select: { questionId: true, isCorrect: true },
  });

  // The first answer given in the session is the one that counts.
  const first = new Map<string, boolean>();
  for (const attempt of attempts) {
    if (!first.has(attempt.questionId)) first.set(attempt.questionId, attempt.isCorrect);
  }

  return questionIds.map((id) => (first.has(id) ? (first.get(id) ? "correct" : "wrong") : "pending"));
}

export async function loadStudySession(profileId: string, sessionId: string): Promise<StudySessionView | null> {
  const session = await getPrismaClient().studySession.findFirst({
    where: { id: sessionId, profileId },
    select: {
      id: true,
      mode: true,
      title: true,
      status: true,
      startedAt: true,
      questions: { orderBy: { position: "asc" }, select: { questionId: true } },
    },
  });

  if (!session) return null;

  const questionIds = session.questions.map((row) => row.questionId);
  const results = await resultsFor(profileId, session.startedAt, questionIds);

  return {
    id: session.id,
    mode: session.mode,
    title: session.title,
    status: session.status,
    startedAt: session.startedAt,
    questionIds,
    results,
    resumeAt: firstPending(results),
  };
}

/** Closes the session and stores its score (idempotent). */
export async function finishStudySession(profileId: string, session: StudySessionView): Promise<void> {
  if (session.status === "FINISHED") return;

  await getPrismaClient().studySession.updateMany({
    where: { id: session.id, profileId, status: "IN_PROGRESS" },
    data: {
      status: "FINISHED",
      finishedAt: new Date(),
      correctCount: session.results.filter((result) => result === "correct").length,
    },
  });
}

export type StudySessionSummary = Readonly<{
  id: string;
  mode: string;
  title: string;
  status: string;
  questionCount: number;
  correctCount: number | null;
  startedAt: Date;
}>;

export async function listStudySessions(profileId: string, take = 10): Promise<StudySessionSummary[]> {
  return getPrismaClient().studySession.findMany({
    where: { profileId },
    orderBy: { startedAt: "desc" },
    take,
    select: { id: true, mode: true, title: true, status: true, questionCount: true, correctCount: true, startedAt: true },
  });
}
