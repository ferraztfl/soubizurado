import type { PrismaClient } from "@/generated/prisma/client";

import type { ClassifiedExample } from "./similar-question-classifier";

/**
 * Published questions (reviewed by a person before publishing) with the names of
 * their taxonomy path. Questions still in review never serve as examples: their
 * classification may be a machine suggestion nobody checked yet.
 */
export async function loadClassifiedExamples(prisma: PrismaClient): Promise<ClassifiedExample[]> {
  const questions = await prisma.question.findMany({
    where: { status: "PUBLISHED", topicId: { not: null }, disciplineId: { not: null } },
    select: {
      id: true,
      statement: true,
      knowledgeAreaId: true,
      disciplineId: true,
      discipline: { select: { name: true } },
      area: { select: { name: true } },
      topic: { select: { name: true } },
      subtopic: { select: { name: true } },
      alternatives: { orderBy: { position: "asc" }, select: { content: true } },
    },
  });

  return questions.flatMap((question) =>
    question.discipline && question.topic
      ? [
          {
            questionId: question.id,
            knowledgeAreaId: question.knowledgeAreaId,
            disciplineId: question.disciplineId,
            text: [question.statement, ...question.alternatives.map((alternative) => alternative.content)].join(" "),
            discipline: question.discipline.name,
            area: question.area?.name ?? null,
            topic: question.topic.name,
            subtopic: question.subtopic?.name ?? null,
          },
        ]
      : [],
  );
}
