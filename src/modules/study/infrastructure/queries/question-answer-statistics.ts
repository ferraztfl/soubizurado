import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

/*
 * Read-only, aggregated: how every student answered a question (all
 * attempts). Only counts leave the server — never who answered what.
 */

export type QuestionAnswerStatistics = Readonly<{
  totalAttempts: number;
  correctAttempts: number;
  /** Attempts per option: alternative id, or "true" / "false" for Certo/Errado. */
  byOption: Readonly<Record<string, number>>;
}>;

export async function loadQuestionAnswerStatistics(questionId: string): Promise<QuestionAnswerStatistics> {
  const groups = await getPrismaClient().studyAnswerAttempt.groupBy({
    by: ["selectedAlternativeId", "selectedTrueFalse", "isCorrect"],
    where: { questionId },
    _count: { _all: true },
  });

  const byOption: Record<string, number> = {};
  let totalAttempts = 0;
  let correctAttempts = 0;

  for (const group of groups) {
    const count = group._count._all;
    const option =
      group.selectedAlternativeId ??
      (group.selectedTrueFalse === null ? null : String(group.selectedTrueFalse));

    totalAttempts += count;

    if (group.isCorrect) {
      correctAttempts += count;
    }

    if (option !== null) {
      byOption[option] = (byOption[option] ?? 0) + count;
    }
  }

  return { totalAttempts, correctAttempts, byOption };
}
