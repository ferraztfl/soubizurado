import type { PrismaClient } from "@/generated/prisma/client";

export type ApplySuggestionResult =
  | Readonly<{
      status: "APPLIED";
      previous: QuestionTaxonomySnapshot;
      next: QuestionTaxonomySnapshot;
    }>
  | Readonly<{
      status:
        | "SUGGESTION_UNAVAILABLE"
        | "QUESTION_UNAVAILABLE"
        | "INVALID_TOPIC";
    }>;

export type QuestionTaxonomySnapshot = Readonly<{
  knowledgeAreaId: string | null;
  disciplineId: string | null;
  areaId: string | null;
  topicId: string | null;
  subtopicId: string | null;
}>;

/**
 * Applies one classification suggestion to its question. Shared by the
 * review screen and the bulk script so both enforce the same rules:
 *
 * - the suggestion belongs to the question and was not applied yet;
 * - the question is still IN_REVIEW (never touches published content);
 * - topic, area, subtopic and discipline are re-validated against the
 *   CURRENT active taxonomy;
 * - a discipline change must stay inside the question knowledge area;
 * - `onlyIfUnclassified` protects manual classifications;
 * - the question update is guarded by status + discipline and the task
 *   is marked applied in the same transaction.
 *
 * Never publishes.
 */
export async function applyClassificationSuggestion(
  prisma: PrismaClient,
  input: Readonly<{
    taskId: string;
    questionId: string;
    appliedByProfileId: string | null;
    onlyIfUnclassified: boolean;
  }>,
): Promise<ApplySuggestionResult> {
  const [task, question] = await Promise.all([
    prisma.questionClassificationTask.findFirst({
      where: {
        id: input.taskId,
        questionId: input.questionId,
        status: { in: ["COMPLETED", "REVIEW_REQUIRED"] },
        appliedAt: null,
        suggestedTopicId: { not: null },
      },
      select: {
        id: true,
        suggestedDisciplineId: true,
        suggestedTopicId: true,
        suggestedSubtopicId: true,
      },
    }),
    prisma.question.findFirst({
      where: {
        id: input.questionId,
        status: "IN_REVIEW",
        ...(input.onlyIfUnclassified ? { topicId: null } : {}),
      },
      select: {
        id: true,
        knowledgeAreaId: true,
        disciplineId: true,
        areaId: true,
        topicId: true,
        subtopicId: true,
      },
    }),
  ]);

  if (!task?.suggestedDisciplineId || !task.suggestedTopicId) {
    return { status: "SUGGESTION_UNAVAILABLE" };
  }

  if (!question?.disciplineId) {
    return { status: "QUESTION_UNAVAILABLE" };
  }

  const topic = await prisma.topic.findFirst({
    where: {
      id: task.suggestedTopicId,
      disciplineId: task.suggestedDisciplineId,
      isActive: true,
      discipline: {
        isActive: true,
        knowledgeAreaId: { not: null },
      },
      OR: [{ areaId: null }, { area: { isActive: true } }],
    },
    select: {
      id: true,
      areaId: true,
      discipline: {
        select: { id: true, knowledgeAreaId: true },
      },
      subtopics: {
        where: {
          id: task.suggestedSubtopicId ?? undefined,
          isActive: true,
        },
        select: { id: true },
        take: 1,
      },
    },
  });

  const sameDiscipline = topic?.discipline.id === question.disciplineId;
  const sameKnowledgeArea =
    question.knowledgeAreaId !== null &&
    topic?.discipline.knowledgeAreaId === question.knowledgeAreaId;

  if (!topic || (!sameDiscipline && !sameKnowledgeArea)) {
    return { status: "INVALID_TOPIC" };
  }

  const next: QuestionTaxonomySnapshot = {
    knowledgeAreaId: topic.discipline.knowledgeAreaId,
    disciplineId: topic.discipline.id,
    areaId: topic.areaId,
    topicId: topic.id,
    subtopicId:
      task.suggestedSubtopicId &&
      topic.subtopics[0]?.id === task.suggestedSubtopicId
        ? task.suggestedSubtopicId
        : null,
  };

  const applied = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.question.updateMany({
      where: {
        id: question.id,
        status: "IN_REVIEW",
        disciplineId: question.disciplineId,
        ...(input.onlyIfUnclassified ? { topicId: null } : {}),
      },
      data: next,
    });

    if (updated.count !== 1) {
      return false;
    }

    const marked = await transaction.questionClassificationTask.updateMany({
      where: { id: task.id, appliedAt: null },
      data: {
        appliedAt: new Date(),
        appliedByProfileId: input.appliedByProfileId,
      },
    });

    if (marked.count !== 1) {
      throw new Error("Classification suggestion was applied concurrently.");
    }

    return true;
  });

  if (!applied) {
    return { status: "QUESTION_UNAVAILABLE" };
  }

  return {
    status: "APPLIED",
    previous: {
      knowledgeAreaId: question.knowledgeAreaId,
      disciplineId: question.disciplineId,
      areaId: question.areaId,
      topicId: question.topicId,
      subtopicId: question.subtopicId,
    },
    next,
  };
}
