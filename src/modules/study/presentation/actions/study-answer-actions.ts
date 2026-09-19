"use server";

import { ensureProfileForAuthUser } from "@/modules/identity/application/ensure-profile";
import type {
  StudyAnswerDisplay,
} from "@/modules/study/application/ports/question-answer-evaluator";
import {
  createSubmitStudyQuestionAnswerUseCase,
} from "@/modules/study/infrastructure/composition/study-application";
import { ApplicationError } from "@/shared/errors/application-error";
import type {
  ErrorCode,
} from "@/shared/errors/error-code";
import {
  ERROR_CODES,
} from "@/shared/errors/error-code";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";

import {
  parseStudyAnswerActionInput,
} from "./study-answer-action-input";

export type StudyAnswerActionSuccess =
  Readonly<{
    ok: true;
    data: Readonly<{
      attemptId: string;
      answeredAt: string;
      questionId: string;
      isCorrect: boolean;
      selectedAnswer: StudyAnswerDisplay;
      correctAnswer: StudyAnswerDisplay;
      explanation: string | null;
    }>;
  }>;

export type StudyAnswerActionFailure =
  Readonly<{
    ok: false;
    code: ErrorCode;
    message: string;
  }>;

export type StudyAnswerActionResult =
  | StudyAnswerActionSuccess
  | StudyAnswerActionFailure;

function publicErrorMessage(
  code: ErrorCode,
): string {
  switch (code) {
    case ERROR_CODES.UNAUTHENTICATED:
      return "Sua sessão expirou. Entre novamente para responder.";
    case ERROR_CODES.NOT_FOUND:
      return "Esta questão não está mais disponível.";
    case ERROR_CODES.VALIDATION_ERROR:
      return "Não foi possível validar a resposta enviada.";
    case ERROR_CODES.FORBIDDEN:
      return "Sua conta não tem permissão para esta ação.";
    case ERROR_CODES.CONFLICT:
      return "Não foi possível concluir a resposta por conflito de dados.";
    case ERROR_CODES.RATE_LIMITED:
      return "Muitas tentativas em pouco tempo. Aguarde e tente novamente.";
    case ERROR_CODES.INTERNAL_ERROR:
    default:
      return "Não foi possível registrar sua resposta agora.";
  }
}

export async function submitStudyAnswerAction(
  rawInput: unknown,
): Promise<StudyAnswerActionResult> {
  const input =
    parseStudyAnswerActionInput(rawInput);

  if (!input) {
    return {
      ok: false,
      code: ERROR_CODES.VALIDATION_ERROR,
      message:
        "Não foi possível validar a resposta enviada.",
    };
  }

  const supabase =
    await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false,
      code: ERROR_CODES.UNAUTHENTICATED,
      message:
        "Sua sessão expirou. Entre novamente para responder.",
    };
  }

  try {
    const displayName =
      typeof user.user_metadata.display_name ===
      "string"
        ? user.user_metadata.display_name
        : null;

    const profile =
      await ensureProfileForAuthUser({
        authUserId: user.id,
        displayName,
      });

    const useCase =
      createSubmitStudyQuestionAnswerUseCase();

    const result = await useCase.execute({
      profileId: profile.id,
      questionId: input.questionId,
      answer: input.answer,
      responseTimeMs:
        input.responseTimeMs ?? null,
    });

    return {
      ok: true,
      data: {
        attemptId: result.attemptId,
        answeredAt:
          result.answeredAt.toISOString(),
        questionId: result.questionId,
        isCorrect: result.isCorrect,
        selectedAnswer:
          result.selectedAnswer,
        correctAnswer:
          result.correctAnswer,
        explanation: result.explanation,
      },
    };
  } catch (caught) {
    if (caught instanceof ApplicationError) {
      return {
        ok: false,
        code: caught.code,
        message: publicErrorMessage(
          caught.code,
        ),
      };
    }

    return {
      ok: false,
      code: ERROR_CODES.INTERNAL_ERROR,
      message: publicErrorMessage(
        ERROR_CODES.INTERNAL_ERROR,
      ),
    };
  }
}
