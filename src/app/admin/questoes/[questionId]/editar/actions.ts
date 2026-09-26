"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import {
  planQuestionContentEdit,
  type QuestionContentEditError,
} from "@/modules/question-bank/domain/question-content-edit";
import {
  validateQuestionForPublication,
} from "@/modules/question-bank/domain/question-publication-policy";
import { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

export type SaveQuestionContentState = Readonly<{
  error: string | null;
}>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const errorMessages: Readonly<Record<QuestionContentEditError, string>> = {
  STATEMENT_REQUIRED: "O enunciado não pode ficar vazio.",
  STATEMENT_TOO_LONG: "O enunciado está longo demais.",
  ALTERNATIVE_TOO_LONG: "Uma das alternativas está longa demais.",
  ALTERNATIVE_EMPTY: "Uma alternativa sem imagem precisa ter texto.",
  UNKNOWN_ALTERNATIVE: "Alternativa inválida para esta questão. Recarregue a página.",
  CORRECT_ALTERNATIVE_REQUIRED: "Marque a alternativa correta.",
  TRUE_FALSE_ANSWER_REQUIRED: "Escolha o gabarito (Certo ou Errado).",
  REASON_REQUIRED: "Informe o motivo da alteração (mínimo de 3 caracteres).",
  REASON_TOO_LONG: "O motivo pode ter no máximo 500 caracteres.",
  ANSWER_KEY_CONFIRMATION_REQUIRED:
    "Esta questão já está publicada. Confirme a troca de gabarito para salvar.",
  NO_CHANGES: "Nenhuma alteração foi feita.",
};

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readTrueFalse(formData: FormData): boolean | null {
  const value = readString(formData, "correctTrueFalse");
  return value === "true" ? true : value === "false" ? false : null;
}

export async function saveQuestionContentAction(
  _previous: SaveQuestionContentState,
  formData: FormData,
): Promise<SaveQuestionContentState> {
  const admin = await requireAdminUser();

  const questionId = readString(formData, "questionId");
  const expectedUpdatedAt = readString(formData, "updatedAt");

  if (!UUID_PATTERN.test(questionId)) {
    return { error: "Questão inválida." };
  }

  const prisma = getPrismaClient();

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      type: true,
      status: true,
      statement: true,
      correctTrueFalse: true,
      answerKeyStatus: true,
      sourceId: true,
      disciplineId: true,
      topicId: true,
      updatedAt: true,
      alternatives: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          label: true,
          content: true,
          isCorrect: true,
          _count: { select: { mediaLinks: true } },
        },
      },
    },
  });

  if (!question || question.status === "ARCHIVED") {
    return { error: "Questão não encontrada ou arquivada." };
  }

  // Someone else saved in the meantime: do not overwrite silently.
  if (question.updatedAt.toISOString() !== expectedUpdatedAt) {
    return {
      error:
        "A questão foi alterada por outra pessoa enquanto você editava. Recarregue a página e refaça a edição.",
    };
  }

  const alternativeContents: Record<string, string> = {};

  for (const [key, value] of formData.entries()) {
    if (key.startsWith("alternative:") && typeof value === "string") {
      alternativeContents[key.slice("alternative:".length)] = value;
    }
  }

  const isPublished = question.status === "PUBLISHED";

  const result = planQuestionContentEdit(
    {
      type: question.type,
      statement: question.statement,
      correctTrueFalse: question.correctTrueFalse,
      answerKeyStatus: question.answerKeyStatus,
      alternatives: question.alternatives.map((alternative) => ({
        id: alternative.id,
        label: alternative.label,
        content: alternative.content,
        isCorrect: alternative.isCorrect,
        mediaCount: alternative._count.mediaLinks,
      })),
    },
    {
      statement: readString(formData, "statement"),
      alternativeContents,
      correctAlternativeId: readString(formData, "correctAlternativeId") || null,
      correctTrueFalse: readTrueFalse(formData),
      reason: readString(formData, "reason"),
      confirmAnswerKeyChange: formData.get("confirmAnswerKeyChange") === "on",
      isPublished,
    },
  );

  if (!result.ok) {
    return { error: errorMessages[result.error] };
  }

  const { plan } = result;

  // A published question must remain publishable after the edit.
  if (isPublished) {
    const mediaCountById = new Map(
      question.alternatives.map((alternative) => [alternative.id, alternative._count.mediaLinks]),
    );
    const issues = validateQuestionForPublication({
      type: question.type,
      statement: plan.after.statement,
      sourceId: question.sourceId,
      disciplineId: question.disciplineId,
      topicId: question.topicId,
      correctTrueFalse: plan.after.correctTrueFalse,
      alternatives: plan.after.alternatives.map((alternative) => ({
        content: alternative.content,
        isCorrect: alternative.isCorrect,
        mediaCount: mediaCountById.get(alternative.id) ?? 0,
      })),
    });

    if (issues.length > 0) {
      return {
        error: "Com essa alteração a questão deixaria de atender à política de publicação.",
      };
    }
  }

  try {
    await prisma.$transaction(async (transaction) => {
      // Guarded update: fails if the row changed after it was read.
      const updated = await transaction.question.updateMany({
        where: { id: question.id, updatedAt: question.updatedAt },
        data: {
          statement: plan.after.statement,
          correctTrueFalse: plan.after.correctTrueFalse,
          answerKeyStatus: plan.after.answerKeyStatus,
        },
      });

      if (updated.count !== 1) {
        throw new ConcurrentEditError();
      }

      // Clear the old correct flag first so there is never a moment
      // with two correct alternatives.
      const ordered = [...plan.alternativeUpdates].sort(
        (left, right) => Number(left.isCorrect) - Number(right.isCorrect),
      );

      for (const update of ordered) {
        await transaction.questionAlternative.update({
          where: { id: update.id },
          data: { content: update.content, isCorrect: update.isCorrect },
        });
      }

      await transaction.questionRevision.create({
        data: {
          questionId: question.id,
          editorProfileId: admin.profileId,
          reason: formData.get("reason")?.toString().trim() ?? "",
          changedFields: [...plan.changedFields],
          answerKeyChanged: plan.answerKeyChanged,
          questionStatus: question.status,
          before: plan.before as unknown as Prisma.InputJsonValue,
          after: plan.after as unknown as Prisma.InputJsonValue,
        },
      });
    });
  } catch (error) {
    if (error instanceof ConcurrentEditError) {
      return {
        error:
          "A questão foi alterada por outra pessoa enquanto você editava. Recarregue a página e refaça a edição.",
      };
    }

    throw error;
  }

  revalidatePath("/admin/questoes/revisao");
  revalidatePath(`/admin/questoes/revisao/${question.id}`);
  revalidatePath(`/admin/questoes/${question.id}/editar`);
  revalidatePath(`/app/questoes/${question.id}`);
  revalidatePath("/app/questoes");

  redirect(`/admin/questoes/${question.id}/editar?saved=1`);
}

class ConcurrentEditError extends Error {}
