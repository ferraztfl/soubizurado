"use server";

import {
  revalidatePath,
} from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  createAssignQuestionTopicUseCase,
  createPublishReviewedQuestionUseCase,
} from "@/modules/question-bank/infrastructure/composition/question-bank-application";
import {
  requireEditorialUser,
} from "@/modules/identity/infrastructure/authorization/require-editorial-user";
import {
  ApplicationError,
} from "@/shared/errors/application-error";

const assignTopicSchema = z.object({
  questionId: z.string().uuid(),
  topicName: z
    .string()
    .trim()
    .min(2)
    .max(180),
});

const publishSchema = z.object({
  questionId: z.string().uuid(),
});

function redirectWithError(
  code: string,
): never {
  redirect(
    `/admin/questoes/revisao?error=${encodeURIComponent(
      code,
    )}`,
  );
}

export async function assignQuestionTopicAction(
  formData: FormData,
) {
  await requireEditorialUser();

  const parsed =
    assignTopicSchema.safeParse({
      questionId:
        formData.get("questionId"),
      topicName:
        formData.get("topicName"),
    });

  if (!parsed.success) {
    redirectWithError(
      "VALIDATION_ERROR",
    );
  }

  try {
    await createAssignQuestionTopicUseCase().execute(
      parsed.data,
    );
  } catch (error) {
    if (error instanceof ApplicationError) {
      redirectWithError(error.code);
    }

    throw error;
  }

  revalidatePath(
    "/admin/questoes/revisao",
  );

  redirect(
    "/admin/questoes/revisao?updated=topic",
  );
}

export async function publishQuestionAction(
  formData: FormData,
) {
  await requireEditorialUser();

  const parsed =
    publishSchema.safeParse({
      questionId:
        formData.get("questionId"),
    });

  if (!parsed.success) {
    redirectWithError(
      "VALIDATION_ERROR",
    );
  }

  try {
    await createPublishReviewedQuestionUseCase().execute(
      parsed.data.questionId,
    );
  } catch (error) {
    if (error instanceof ApplicationError) {
      redirectWithError(error.code);
    }

    throw error;
  }

  revalidatePath(
    "/admin/questoes/revisao",
  );
  revalidatePath("/app/questoes");

  redirect(
    "/admin/questoes/revisao?updated=published",
  );
}
