import { DEFAULT_STUDY_PREFERENCES, type StudyPreferences } from "@/modules/study/domain/study-preferences";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

/** The student's goals and privacy choices; defaults until they save them. */
export async function loadStudyPreferences(profileId: string): Promise<StudyPreferences> {
  const row = await getPrismaClient().studyPreference.findUnique({
    where: { profileId },
    select: { dailyGoal: true, targetExam: true, targetBoardId: true, targetExamDate: true, showInRanking: true },
  });

  if (!row) {
    return DEFAULT_STUDY_PREFERENCES;
  }

  return {
    dailyGoal: row.dailyGoal,
    targetExam: row.targetExam,
    targetBoardId: row.targetBoardId,
    targetExamDate: row.targetExamDate ? row.targetExamDate.toISOString().slice(0, 10) : null,
    showInRanking: row.showInRanking,
  };
}

/** YYYY-MM-DD in Brazil's official time. */
export function todayInSaoPaulo(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}
