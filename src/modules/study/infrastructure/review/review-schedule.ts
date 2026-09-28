import type { Prisma } from "@/generated/prisma/client";
import { nextReview } from "@/modules/study/domain/spaced-review";

const day = (date: Date) => date.toISOString().slice(0, 10);

/** YYYY-MM-DD in Brazil's official time. */
function localDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
}

/**
 * Updates the spaced review of one question after an answer. Runs in the
 * transaction that records the answer, so the queue never drifts from it.
 */
export async function applyReviewAfterAnswer(
  transaction: Prisma.TransactionClient,
  input: Readonly<{ profileId: string; questionId: string; isCorrect: boolean; answeredAt: Date }>,
): Promise<void> {
  const key = { profileId_questionId: { profileId: input.profileId, questionId: input.questionId } };
  const current = await transaction.studyReviewItem.findUnique({
    where: key,
    select: { step: true, dueOn: true, lapses: true },
  });

  const update = nextReview(
    current ? { step: current.step, dueOn: day(current.dueOn), lapses: current.lapses } : null,
    input.isCorrect,
    localDay(input.answeredAt),
  );

  if (update.kind === "NONE") {
    return;
  }

  if (update.kind === "LEARNED") {
    await transaction.studyReviewItem.delete({ where: key });
    return;
  }

  const data = {
    step: update.state.step,
    dueOn: new Date(`${update.state.dueOn}T00:00:00Z`),
    lapses: update.state.lapses,
    lastAnsweredAt: input.answeredAt,
  };

  await transaction.studyReviewItem.upsert({
    where: key,
    update: data,
    create: { profileId: input.profileId, questionId: input.questionId, ...data },
  });
}
