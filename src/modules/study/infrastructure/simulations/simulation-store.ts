import type { Prisma } from "@/generated/prisma/client";
import type { PublicQuestionReadFilters } from "@/modules/question-bank/application/ports/public-question-read-repository";
import { PrismaPublicQuestionReadRepository } from "@/modules/question-bank/infrastructure/repositories/prisma-public-question-read-repository";
import { isSimulationExpired } from "@/modules/study/domain/simulation";
import { createSubmitStudyQuestionAnswerUseCase } from "@/modules/study/infrastructure/composition/study-application";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

/*
 * Persistence of practice exams. Every function takes the owner's profile
 * id and only touches that profile's simulations.
 */

export type SimulationAnswer =
  | Readonly<{ type: "MULTIPLE_CHOICE"; alternativeId: string }>
  | Readonly<{ type: "TRUE_FALSE"; value: boolean }>;

export type SimulationSummary = Readonly<{
  id: string;
  title: string;
  questionCount: number;
  timeLimitMinutes: number | null;
  status: string;
  correctCount: number | null;
  startedAt: Date;
  finishedAt: Date | null;
  answered: number;
}>;

export async function createSimulation(
  input: Readonly<{
    profileId: string;
    title: string;
    filters: PublicQuestionReadFilters;
    filtersForDisplay: Prisma.InputJsonValue;
    questionCount: number;
    timeLimitMinutes: number | null;
  }>,
): Promise<{ id: string; drawn: number } | null> {
  // Drawn in the database: never loads every matching id (millions of questions).
  const drawn = await new PrismaPublicQuestionReadRepository().drawPublishedIds(input.filters, input.questionCount);

  if (drawn.length === 0) {
    return null;
  }

  const simulation = await getPrismaClient().studySimulation.create({
    data: {
      profileId: input.profileId,
      title: input.title,
      filters: input.filtersForDisplay,
      questionCount: drawn.length,
      timeLimitMinutes: input.timeLimitMinutes,
      questions: {
        create: drawn.map((questionId, position) => ({ questionId, position })),
      },
    },
    select: { id: true },
  });

  return { id: simulation.id, drawn: drawn.length };
}

export async function listSimulations(profileId: string): Promise<SimulationSummary[]> {
  const rows = await getPrismaClient().studySimulation.findMany({
    where: { profileId },
    orderBy: { startedAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      questionCount: true,
      timeLimitMinutes: true,
      status: true,
      correctCount: true,
      startedAt: true,
      finishedAt: true,
      _count: {
        select: {
          questions: { where: { OR: [{ selectedAlternativeId: { not: null } }, { selectedTrueFalse: { not: null } }] } },
        },
      },
    },
  });

  return rows.map(({ _count, ...row }) => ({ ...row, answered: _count.questions }));
}

export async function loadSimulation(profileId: string, simulationId: string) {
  return getPrismaClient().studySimulation.findFirst({
    where: { id: simulationId, profileId },
    select: {
      id: true,
      title: true,
      filters: true,
      questionCount: true,
      timeLimitMinutes: true,
      status: true,
      correctCount: true,
      startedAt: true,
      finishedAt: true,
      questions: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          questionId: true,
          position: true,
          selectedAlternativeId: true,
          selectedTrueFalse: true,
          isCorrect: true,
        },
      },
    },
  });
}

export type LoadedSimulation = NonNullable<Awaited<ReturnType<typeof loadSimulation>>>;

/**
 * Records (or clears, with null) the answer to one question while the exam
 * is running. Refused once finished or out of time.
 */
export async function saveSimulationAnswer(
  profileId: string,
  simulationId: string,
  questionId: string,
  answer: SimulationAnswer | null,
): Promise<"saved" | "not-found" | "closed" | "invalid"> {
  const prisma = getPrismaClient();
  const simulation = await prisma.studySimulation.findFirst({
    where: { id: simulationId, profileId },
    select: { status: true, startedAt: true, timeLimitMinutes: true },
  });

  if (!simulation) {
    return "not-found";
  }

  if (simulation.status !== "IN_PROGRESS" || isSimulationExpired(simulation.startedAt, simulation.timeLimitMinutes)) {
    return "closed";
  }

  const item = await prisma.studySimulationQuestion.findFirst({
    where: { simulationId, questionId },
    select: { id: true, question: { select: { type: true } } },
  });

  if (!item) {
    return "not-found";
  }

  if (answer?.type === "MULTIPLE_CHOICE") {
    const belongs = await prisma.questionAlternative.count({ where: { id: answer.alternativeId, questionId } });

    if (belongs === 0 || item.question.type !== "MULTIPLE_CHOICE") {
      return "invalid";
    }
  }

  if (answer?.type === "TRUE_FALSE" && item.question.type !== "TRUE_FALSE") {
    return "invalid";
  }

  await prisma.studySimulationQuestion.update({
    where: { id: item.id },
    data: {
      selectedAlternativeId: answer?.type === "MULTIPLE_CHOICE" ? answer.alternativeId : null,
      selectedTrueFalse: answer?.type === "TRUE_FALSE" ? answer.value : null,
    },
  });

  return "saved";
}

/**
 * Grades the exam: each answered question goes through the regular answer
 * use case (so it counts in the student's performance); unanswered ones are
 * wrong. Idempotent: a finished simulation is left as is.
 */
export async function finishSimulation(profileId: string, simulationId: string): Promise<"finished" | "not-found"> {
  const prisma = getPrismaClient();
  const simulation = await loadSimulation(profileId, simulationId);

  if (!simulation) {
    return "not-found";
  }

  if (simulation.status === "FINISHED") {
    return "finished";
  }

  // Claim the simulation first, so a double click cannot grade twice.
  const claimed = await prisma.studySimulation.updateMany({
    where: { id: simulationId, profileId, status: "IN_PROGRESS" },
    data: { status: "FINISHED", finishedAt: new Date() },
  });

  if (claimed.count === 0) {
    return "finished";
  }

  const submit = createSubmitStudyQuestionAnswerUseCase();
  let correct = 0;

  for (const item of simulation.questions) {
    const answer: SimulationAnswer | null = item.selectedAlternativeId
      ? { type: "MULTIPLE_CHOICE", alternativeId: item.selectedAlternativeId }
      : item.selectedTrueFalse !== null
        ? { type: "TRUE_FALSE", value: item.selectedTrueFalse }
        : null;

    if (!answer) {
      await prisma.studySimulationQuestion.update({ where: { id: item.id }, data: { isCorrect: false } });
      continue;
    }

    try {
      const result = await submit.execute({ profileId, questionId: item.questionId, answer, responseTimeMs: null });
      correct += result.isCorrect ? 1 : 0;
      await prisma.studySimulationQuestion.update({
        where: { id: item.id },
        data: { isCorrect: result.isCorrect, attemptId: result.attemptId },
      });
    } catch {
      // A question unpublished during the exam cannot be graded: it counts as wrong.
      await prisma.studySimulationQuestion.update({ where: { id: item.id }, data: { isCorrect: false } });
    }
  }

  await prisma.studySimulation.update({ where: { id: simulationId }, data: { correctCount: correct } });

  return "finished";
}

/** Correct option of each question, for the result page (after finishing only). */
export async function loadAnswerKeys(questionIds: readonly string[]) {
  const rows = await getPrismaClient().question.findMany({
    where: { id: { in: [...questionIds] } },
    select: {
      id: true,
      correctTrueFalse: true,
      alternatives: { where: { isCorrect: true }, select: { id: true, label: true } },
    },
  });

  return new Map(
    rows.map((row) => [
      row.id,
      { alternativeId: row.alternatives[0]?.id ?? null, label: row.alternatives[0]?.label ?? null, trueFalse: row.correctTrueFalse },
    ]),
  );
}
