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
    `/app/revisao-questoes/${questionId}`;

  return query
    ? `${base}?${query}`
    : base;
}

export async function saveQuestionTopicAction(
  formData: FormData,
): Promise<void> {
  await requireAdminUser();

  const questionId =
    readRequiredString(
      formData,
      "questionId",
    );

  const topicId =
    readRequiredString(
      formData,
      "topicId",
    );

  if (!questionId) {
    redirect(
      "/app/revisao-questoes",
    );
  }

  if (!topicId) {
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

  const topic =
    await prisma.topic.findFirst({
      where: {
        id:
          topicId,

        disciplineId:
          question.disciplineId,

        isActive:
          true,
      },

      select: {
        id: true,
      },
    });

  if (!topic) {
    redirect(
      reviewUrl(
        questionId,
        "error=invalid-topic",
      ),
    );
  }

  await prisma.question.update({
    where: {
      id:
        question.id,
    },

    data: {
      topicId:
        topic.id,

      subtopicId:
        null,
    },
  });

  revalidatePath(
    reviewUrl(questionId),
  );

  revalidatePath(
    "/app/revisao-questoes",
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
      "/app/revisao-questoes",
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
    "/app/revisao-questoes",
  );

  redirect(
    `/app/questoes/${questionId}`,
  );
}