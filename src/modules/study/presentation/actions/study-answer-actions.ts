"use server";

import { ensureProfileForAuthUser } from "@/modules/identity/application/ensure-profile";
import type {
  StudyAnswerDisplay,
} from "@/modules/study/application/ports/question-answer-evaluator";
import {
  createQuestionAnswerEvaluator,
  createSubmitStudyQuestionAnswerUseCase,
} from "@/modules/study/infrastructure/composition/study-application";
import { consumeVisitorAnswer } from "@/modules/study/infrastructure/visitors/visitor-usage";
import { isQuestionInAccessibleCourse } from "@/modules/courses/infrastructure/course-access";
import { limitReachedMessage } from "@/modules/study/domain/access";
import { loadAnswerAllowance } from "@/modules/study/infrastructure/queries/student-access";
import {
  loadQuestionAnswerStatistics,
  type QuestionAnswerStatistics,
} from "@/modules/study/infrastructure/queries/question-answer-statistics";
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
      /** How all students answered, this attempt included; null if unavailable. */
      statistics: QuestionAnswerStatistics | null;
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
    return submitVisitorAnswer(input);
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

    // Freemium: checked before grading, so the answer key is never revealed past the limit.
    const allowance = await loadAnswerAllowance(profile.id);

    // Questions of a course lesson the student can open are part of what they bought.
    if (!allowance.canAnswer && !(await isQuestionInAccessibleCourse(profile.id, input.questionId))) {
      return {
        ok: false,
        code: ERROR_CODES.LIMIT_REACHED,
        message: limitReachedMessage(allowance),
      };
    }

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
        // Statistics are a bonus: a failure here must not hide the answer.
        statistics: await loadQuestionAnswerStatistics(result.questionId).catch(() => null),
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

/**
 * Signed-out visitor (public question pages): 1 graded answer per day,
 * nothing recorded but the hashed daily counter.
 */
async function submitVisitorAnswer(
  input: NonNullable<ReturnType<typeof parseStudyAnswerActionInput>>,
): Promise<StudyAnswerActionResult> {
  try {
    const { allowed, allowance } = await consumeVisitorAnswer();

    if (!allowed) {
      return { ok: false, code: ERROR_CODES.LIMIT_REACHED, message: limitReachedMessage(allowance) };
    }

    const evaluation = await createQuestionAnswerEvaluator().evaluate({
      questionId: input.questionId,
      answer: input.answer,
    });

    return {
      ok: true,
      data: {
        attemptId: "",
        answeredAt: new Date().toISOString(),
        questionId: evaluation.questionId,
        isCorrect: evaluation.isCorrect,
        selectedAnswer: evaluation.selectedAnswer,
        correctAnswer: evaluation.correctAnswer,
        explanation: evaluation.explanation,
        statistics: await loadQuestionAnswerStatistics(evaluation.questionId).catch(() => null),
      },
    };
  } catch (caught) {
    const code = caught instanceof ApplicationError ? caught.code : ERROR_CODES.INTERNAL_ERROR;
    return { ok: false, code, message: publicErrorMessage(code) };
  }
}
