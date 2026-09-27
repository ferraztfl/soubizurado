"use server";

import { z } from "zod";

import { ensureProfileForAuthUser } from "@/modules/identity/application/ensure-profile";
import {
  QUESTION_ERROR_DETAILS_MAX_LENGTH,
  QUESTION_ERROR_REASONS,
  QUESTION_NOTE_MAX_LENGTH,
  type QuestionErrorReason,
} from "@/modules/study/domain/question-error-report";
import { createSetStudyQuestionFavoriteUseCase } from "@/modules/study/infrastructure/composition/study-application";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";

/*
 * Favorites, private notes and "Reportar erro" for the signed-in student.
 * Every action re-checks the session and that the question is published.
 */

export type QuestionToolActionResult<T = null> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; message: string }>;

const questionIdSchema = z.uuid();

const reasonSchema = z.enum(Object.keys(QUESTION_ERROR_REASONS) as [QuestionErrorReason, ...QuestionErrorReason[]]);

async function requireStudentForPublishedQuestion(
  questionId: unknown,
): Promise<Readonly<{ profileId: string; questionId: string }> | string> {
  const parsedId = questionIdSchema.safeParse(questionId);

  if (!parsedId.success) {
    return "Questão inválida.";
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return "Sua sessão expirou. Entre novamente.";
  }

  const published = await getPrismaClient().question.count({
    where: { id: parsedId.data, status: "PUBLISHED" },
  });

  if (published === 0) {
    return "Esta questão não está mais disponível.";
  }

  const displayName = typeof user.user_metadata.display_name === "string" ? user.user_metadata.display_name : null;
  const profile = await ensureProfileForAuthUser({ authUserId: user.id, displayName });

  return { profileId: profile.id, questionId: parsedId.data };
}

export async function setQuestionFavoriteAction(
  questionId: unknown,
  favorite: unknown,
): Promise<QuestionToolActionResult<{ favorite: boolean }>> {
  if (typeof favorite !== "boolean") {
    return { ok: false, message: "Pedido inválido." };
  }

  try {
    const student = await requireStudentForPublishedQuestion(questionId);

    if (typeof student === "string") {
      return { ok: false, message: student };
    }

    await createSetStudyQuestionFavoriteUseCase().execute({ ...student, favorite });

    return { ok: true, data: { favorite } };
  } catch {
    return { ok: false, message: "Não foi possível atualizar o favorito agora." };
  }
}

/** Saves the student's note; an empty note deletes it. */
export async function saveQuestionNoteAction(
  questionId: unknown,
  content: unknown,
): Promise<QuestionToolActionResult<{ note: string | null }>> {
  const parsed = z.string().max(QUESTION_NOTE_MAX_LENGTH).safeParse(content);

  if (!parsed.success) {
    return { ok: false, message: `A anotação pode ter até ${QUESTION_NOTE_MAX_LENGTH} caracteres.` };
  }

  try {
    const student = await requireStudentForPublishedQuestion(questionId);

    if (typeof student === "string") {
      return { ok: false, message: student };
    }

    const note = parsed.data.trim();
    const prisma = getPrismaClient();
    const key = { profileId_questionId: { profileId: student.profileId, questionId: student.questionId } };

    if (note.length === 0) {
      await prisma.studyQuestionNote.deleteMany({ where: key.profileId_questionId });

      return { ok: true, data: { note: null } };
    }

    await prisma.studyQuestionNote.upsert({
      where: key,
      create: { ...key.profileId_questionId, content: note },
      update: { content: note },
    });

    return { ok: true, data: { note } };
  } catch {
    return { ok: false, message: "Não foi possível salvar a anotação agora." };
  }
}

export async function reportQuestionErrorAction(
  questionId: unknown,
  reason: unknown,
  details: unknown,
): Promise<QuestionToolActionResult> {
  const parsedReason = reasonSchema.safeParse(reason);
  const parsedDetails = z.string().max(QUESTION_ERROR_DETAILS_MAX_LENGTH).safeParse(details ?? "");

  if (!parsedReason.success) {
    return { ok: false, message: "Escolha o tipo de problema." };
  }

  if (!parsedDetails.success) {
    return { ok: false, message: `A descrição pode ter até ${QUESTION_ERROR_DETAILS_MAX_LENGTH} caracteres.` };
  }

  const detailsText = parsedDetails.data.trim();

  if (parsedReason.data === "OTHER" && detailsText.length < 5) {
    return { ok: false, message: "Descreva o problema em poucas palavras." };
  }

  try {
    const student = await requireStudentForPublishedQuestion(questionId);

    if (typeof student === "string") {
      return { ok: false, message: student };
    }

    const prisma = getPrismaClient();
    const open = await prisma.questionErrorReport.count({
      where: { questionId: student.questionId, reporterProfileId: student.profileId, status: "OPEN" },
    });

    if (open > 0) {
      return { ok: false, message: "Você já tem um reporte em análise para esta questão." };
    }

    await prisma.questionErrorReport.create({
      data: {
        questionId: student.questionId,
        reporterProfileId: student.profileId,
        reason: parsedReason.data,
        details: detailsText.length > 0 ? detailsText : null,
      },
    });

    return { ok: true, data: null };
  } catch {
    return { ok: false, message: "Não foi possível enviar o reporte agora." };
  }
}
