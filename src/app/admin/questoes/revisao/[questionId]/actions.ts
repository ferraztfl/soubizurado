"use server";

import {
  revalidatePath,
} from "next/cache";
import {
  redirect,
} from "next/navigation";

import {
  applyClassificationSuggestion,
} from "@/modules/classification/infrastructure/apply-classification-suggestion";
import {
  classifyWithManualPath,
} from "@/modules/taxonomy/infrastructure/classify-with-manual-path";
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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
        knowledgeAreaId: true,
        discipline: {
          select: {
            knowledgeAreaId: true,
          },
        },
      },
    });

  // Any active discipline of the question knowledge area can be chosen
  // and becomes the question discipline: a booklet section (e.g.
  // "Extravagante") may fix a discipline that does not fit every
  // question. The area comes from the current canonical discipline or,
  // without one (legacy ENEM, knowledge-area-only imports), from the
  // question itself.
  const scopeKnowledgeAreaId =
    question?.discipline?.knowledgeAreaId ??
    question?.knowledgeAreaId ??
    null;

  if (
    !question ||
    !scopeKnowledgeAreaId
  ) {
    redirect(
      reviewUrl(
        questionId,
        "error=question-unavailable",
      ),
    );
  }

  const disciplineScope = {
    discipline: {
      isActive:
        true,
      knowledgeAreaId:
        scopeKnowledgeAreaId,
    },
  };

  // Only active entries are accepted; an inactive assunto blocks its
  // topics too.
  const activeTopicWhere = {
    ...disciplineScope,
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

  const topicSelect = {
    id: true,
    areaId: true,
    disciplineId: true,
    discipline: {
      select: {
        knowledgeAreaId: true,
      },
    },
  } as const;

  let classification:
    | Readonly<{
        knowledgeAreaId: string | null;
        disciplineId: string;
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

        select:
          topicSelect,
      });

    // Choosing a topic clears any previous subtopic.
    classification = topic
      ? {
          knowledgeAreaId:
            topic.discipline.knowledgeAreaId,
          disciplineId:
            topic.disciplineId,
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
            select:
              topicSelect,
          },
        },
      });

    classification = subtopic
      ? {
          knowledgeAreaId:
            subtopic.topic.discipline
              .knowledgeAreaId,
          disciplineId:
            subtopic.topic.disciplineId,
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

/**
 * Classifies by a typed path, creating the taxonomy levels that do not exist
 * yet (administrators only; AI and importers never create taxonomy).
 */
export async function classifyWithNewPathAction(
  formData: FormData,
): Promise<void> {
  const admin = await requireAdminUser();
  const questionId = readRequiredString(formData, "questionId");

  if (!questionId || !UUID_PATTERN.test(questionId)) {
    redirect("/admin/questoes/revisao");
  }

  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };
  const disciplineId = text("disciplineId");

  if (!UUID_PATTERN.test(disciplineId)) {
    redirect(reviewUrl(questionId, "error=path-discipline"));
  }

  const result = await classifyWithManualPath(getPrismaClient(), {
    questionId,
    disciplineId,
    area: text("area"),
    topic: text("topic"),
    subtopic: text("subtopic"),
    actorProfileId: admin.profileId,
  });

  if (!result.ok) {
    const query = new URLSearchParams({ error: result.error });

    if (result.detail) query.set("detail", result.detail);
    redirect(reviewUrl(questionId, query.toString()));
  }

  const query = new URLSearchParams({ saved: "created" });

  if (result.created.length > 0) {
    query.set("detail", result.created.map((entry) => entry.name).join(" › "));
  }

  revalidatePath(reviewUrl(questionId));
  revalidatePath("/admin/questoes/revisao");
  redirect(reviewUrl(questionId, query.toString()));
}

export async function applyClassificationSuggestionAction(
  formData: FormData,
): Promise<void> {
  const admin =
    await requireAdminUser();

  const questionId =
    readRequiredString(
      formData,
      "questionId",
    );

  const taskId =
    readRequiredString(
      formData,
      "taskId",
    );

  if (!questionId) {
    redirect(
      "/admin/questoes/revisao",
    );
  }

  if (!taskId) {
    redirect(
      reviewUrl(
        questionId,
        "error=suggestion-unavailable",
      ),
    );
  }

  const result =
    await applyClassificationSuggestion(
      getPrismaClient(),
      {
        taskId,
        questionId,
        appliedByProfileId:
          admin.profileId,
        onlyIfUnclassified:
          false,
      },
    );

  if (
    result.status !==
    "APPLIED"
  ) {
    const errorByStatus = {
      SUGGESTION_UNAVAILABLE:
        "suggestion-unavailable",
      QUESTION_UNAVAILABLE:
        "question-unavailable",
      INVALID_TOPIC:
        "invalid-topic",
    } as const;

    redirect(
      reviewUrl(
        questionId,
        `error=${errorByStatus[result.status]}`,
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
      "saved=suggestion",
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

        source: {
          select: {
            sourceType: true,
          },
        },

        examination: {
          select: {
            boardId: true,
            year: true,
          },
        },

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
            _count: {
              select: {
                mediaLinks: true,
              },
            },
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

      sourceType:
        question.source
          ?.sourceType ?? null,

      examination:
        question.examination,

      disciplineId:
        question.disciplineId,

      topicId:
        question.topicId,

      type:
        question.type,

      correctTrueFalse:
        question.correctTrueFalse,

      alternatives:
        question.alternatives.map(
          (alternative) => ({
            content:
              alternative.content,

            isCorrect:
              alternative.isCorrect,

            mediaCount:
              alternative._count
                .mediaLinks,
          }),
        ),
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