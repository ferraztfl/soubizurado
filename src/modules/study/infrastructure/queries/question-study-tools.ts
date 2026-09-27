import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

/*
 * Read-only: the student's own favorites, notes and open reports for a page
 * of questions, so the question tools render with the right initial state.
 */

export type QuestionStudyToolsState = Readonly<{
  favorite: boolean;
  note: string | null;
  hasOpenReport: boolean;
}>;

export const EMPTY_QUESTION_STUDY_TOOLS: QuestionStudyToolsState = {
  favorite: false,
  note: null,
  hasOpenReport: false,
};

export async function loadQuestionStudyTools(
  profileId: string,
  questionIds: readonly string[],
): Promise<ReadonlyMap<string, QuestionStudyToolsState>> {
  if (questionIds.length === 0) {
    return new Map();
  }

  const prisma = getPrismaClient();
  const ids = [...questionIds];

  const [favorites, notes, reports] = await Promise.all([
    prisma.studyFavorite.findMany({
      where: { profileId, questionId: { in: ids } },
      select: { questionId: true },
    }),
    prisma.studyQuestionNote.findMany({
      where: { profileId, questionId: { in: ids } },
      select: { questionId: true, content: true },
    }),
    prisma.questionErrorReport.findMany({
      where: { reporterProfileId: profileId, questionId: { in: ids }, status: "OPEN" },
      select: { questionId: true },
    }),
  ]);

  const state = new Map<string, QuestionStudyToolsState>();
  const get = (questionId: string) => state.get(questionId) ?? EMPTY_QUESTION_STUDY_TOOLS;

  for (const favorite of favorites) {
    state.set(favorite.questionId, { ...get(favorite.questionId), favorite: true });
  }

  for (const note of notes) {
    state.set(note.questionId, { ...get(note.questionId), note: note.content });
  }

  for (const report of reports) {
    state.set(report.questionId, { ...get(report.questionId), hasOpenReport: true });
  }

  return state;
}
