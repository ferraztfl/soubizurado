import type {
  PrismaClient,
} from "@/generated/prisma/client";

import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import type {
  CreateStudyAnswerAttemptInput,
  StudyAnswerAttemptRecord,
  StudyRepository,
} from "../../application/ports/study-repository";

const studyAnswerAttemptSelect = {
  id: true,
  profileId: true,
  questionId: true,
  questionType: true,
  selectedAlternativeId: true,
  selectedTrueFalse: true,
  isCorrect: true,
  responseTimeMs: true,
  answeredAt: true,
} as const;

export class PrismaStudyRepository
  implements StudyRepository
{
  public constructor(
    private readonly prisma: PrismaClient = getPrismaClient(),
  ) {}

  public async createAnswerAttempt(
    input: CreateStudyAnswerAttemptInput,
  ): Promise<StudyAnswerAttemptRecord> {
    return this.prisma.studyAnswerAttempt.create({
      data: {
        profileId: input.profileId,
        questionId: input.questionId,
        questionType: input.questionType,
        selectedAlternativeId:
          input.selectedAlternativeId,
        selectedTrueFalse: input.selectedTrueFalse,
        isCorrect: input.isCorrect,
        responseTimeMs: input.responseTimeMs,
      },
      select: studyAnswerAttemptSelect,
    });
  }
}
