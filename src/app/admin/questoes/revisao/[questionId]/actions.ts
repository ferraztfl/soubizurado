"use server";

import {
  revalidatePath,
} from "next/cache";
import {
  redirect,
} from "next/navigation";

import {
  requireAdminUser,
} from "@/modules/identity/application/require-admin-user";
import {
  validateQuestionForPublication,
} from "@/modules/question-bank/domain/question-publication-policy";
import {
  parseQuestionClassificationChoice,
} from "@/modules/question-bank/presentation/question-classification-choice";
import {
  getPrismaClient,
} from "@/shared/infrastructure/database/prisma";

function readRequiredString(
  formData: FormData,
  key: string,
): string | null {
  const value =
    formData.get(key);

  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const normalized =
    value.trim();

  return normalized ||
    null;
}

function reviewUrl(
  questionId: string,
  query?: string,
): string {
  const base =
    `/admin/questoes/revisao/${questionId}`;

  return query
    ? `${base}?${query}`
    : base;
}

export async function saveQuestionClassificationAction(
  formData: FormData,
): Promise<void> {
  await requireAdminUser();

  const questionId =
    readRequiredString(
      formData,
      "questionId",
    );

  if (!questionId) {
    redirect(
      "/admin/questoes/revisao",
    );
  }

  const choice =
    parseQuestionClassificationChoice(
      formData.get(
        "classification",
      ),
    );

  if (!choice) {
    redirect(
      reviewUrl(
        questionId,
        "error=topic-required",
      ),
    );
  }

  const prisma =
    getPrismaClient();

  const question =
    await prisma.question.findFirst({
      where: {
        id:
          questionId,
        status:
          "IN_REVIEW",
      },

      select: {
        id: true,
        disciplineId: true,
      },
    });

  if (
    !question ||
    !question.disciplineId
  ) {
    redirect(
      reviewUrl(
        questionId,
        "error=question-unavailable",
      ),
    );
  }

  // Only active entries of the question discipline are accepted; an
  // inactive assunto blocks its topics too.
  const activeTopicWhere = {
    disciplineId:
      question.disciplineId,
    isActive:
      true,
    OR: [
      {
        areaId:
          null,
      },
      {
        area: {
          isActive:
            true,
        },
      },
    ],
  };

  let classification:
    | Readonly<{
        areaId: string | null;
        topicId: string;
        subtopicId: string | null;
      }>
    | null = null;

  if (choice.kind === "topic") {
    const topic =
      await prisma.topic.findFirst({
        where: {
          id:
            choice.topicId,
          ...activeTopicWhere,
        },

        select: {
          id: true,
          areaId: true,
        },
      });

    // Choosing a topic clears any previous subtopic.
    classification = topic
      ? {
          areaId:
            topic.areaId,
          topicId:
            topic.id,
          subtopicId:
            null,
        }
      : null;
  } else {
    const subtopic =
      await prisma.subtopic.findFirst({
        where: {
          id:
            choice.subtopicId,
          isActive:
            true,
          topic:
            activeTopicWhere,
        },

        select: {
          id: true,
          topic: {
            select: {
              id: true,
              areaId: true,
            },
          },
        },
      });

    classification = subtopic
      ? {
          areaId:
            subtopic.topic.areaId,
          topicId:
            subtopic.topic.id,
          subtopicId:
            subtopic.id,
        }
      : null;
  }

  if (!classification) {
    redirect(
      reviewUrl(
        questionId,
        "error=invalid-topic",
      ),
    );
  }

  const result =
    await prisma.question.updateMany({
      where: {
        id:
          question.id,

        status:
          "IN_REVIEW",

        disciplineId:
          question.disciplineId,
      },

      data: classification,
    });

  if (
    result.count !== 1
  ) {
    redirect(
      reviewUrl(
        questionId,
        "error=question-unavailable",
      ),
    );
  }

  revalidatePath(
    reviewUrl(questionId),
  );

  revalidatePath(
    "/admin/questoes/revisao",
  );

  redirect(
    reviewUrl(
      questionId,
      "saved=1",
    ),
  );
}

export async function publishQuestionAction(
  formData: FormData,
): Promise<void> {
  await requireAdminUser();

  const questionId =
    readRequiredString(
      formData,
      "questionId",
    );

  if (!questionId) {
    redirect(
      "/admin/questoes/revisao",
    );
  }

  const prisma =
    getPrismaClient();

  const question =
    await prisma.question.findFirst({
      where: {
        id:
          questionId,

        status:
          "IN_REVIEW",
      },

      select: {
        id: true,
        statement: true,
        type: true,
        answerKeyStatus: true,
        correctTrueFalse: true,
        sourceId: true,
        disciplineId: true,
        topicId: true,

        topic: {
          select: {
            disciplineId:
              true,
            isActive:
              true,
          },
        },

        alternatives: {
          select: {
            content: true,
            isCorrect: true,
          },
        },
      },
    });

  if (!question) {
    redirect(
      reviewUrl(
        questionId,
        "error=question-unavailable",
      ),
    );
  }

  if (
    !question.topic ||
    !question.topicId ||
    question.topic.disciplineId !==
      question.disciplineId ||
    !question.topic.isActive
  ) {
    redirect(
      reviewUrl(
        questionId,
        "error=invalid-topic",
      ),
    );
  }

  if (
    question.answerKeyStatus !==
      "DEFINED" &&
    question.answerKeyStatus !==
      "VERIFIED"
  ) {
    redirect(
      reviewUrl(
        questionId,
        "error=answer-key",
      ),
    );
  }

  const issues =
    validateQuestionForPublication({
      statement:
        question.statement,

      sourceId:
        question.sourceId,

      disciplineId:
        question.disciplineId,

      topicId:
        question.topicId,

      type:
        question.type,

      correctTrueFalse:
        question.correctTrueFalse,

      alternatives:
        question.alternatives,
    });

  if (
    issues.length > 0
  ) {
    redirect(
      reviewUrl(
        questionId,
        "error=publication-blocked",
      ),
    );
  }

  const result =
    await prisma.question.updateMany({
      where: {
        id:
          question.id,

        status:
          "IN_REVIEW",
      },

      data: {
        status:
          "PUBLISHED",

        answerKeyStatus:
          "VERIFIED",

        publishedAt:
          new Date(),
      },
    });

  if (
    result.count !== 1
  ) {
    redirect(
      reviewUrl(
        questionId,
        "error=question-unavailable",
      ),
    );
  }

  revalidatePath(
    "/app/questoes",
  );

  revalidatePath(
    `/app/questoes/${questionId}`,
  );

  revalidatePath(
    "/admin/questoes/revisao",
  );

  redirect(
    `/app/questoes/${questionId}`,
  );
}