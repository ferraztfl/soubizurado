"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { hasCourseAccess } from "@/modules/courses/infrastructure/course-access";
import { ensureProfileForAuthUser } from "@/modules/identity/application/ensure-profile";
import {
  parseQuestionExplorerSearchParams,
  QUESTION_EXPLORER_SITUATIONS,
} from "@/modules/question-bank/presentation/question-explorer-search-params";
import { SIMULATION_QUESTION_COUNTS, SIMULATION_TIME_LIMITS } from "@/modules/study/domain/simulation";
import {
  createSimulation,
  finishSimulation,
  saveSimulationAnswer,
} from "@/modules/study/infrastructure/simulations/simulation-store";
import { createOfficialSimulation, loadOfficialExam } from "@/modules/study/infrastructure/simulations/official-simulation-store";
import { hasPremiumAccess, loadAnswerAllowance } from "@/modules/study/infrastructure/queries/student-access";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";

/*
 * Simulados. Each action re-checks the session; the store only touches
 * simulations of the signed-in student's profile.
 */

async function requireProfileId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const displayName = typeof user.user_metadata.display_name === "string" ? user.user_metadata.display_name : null;
  const profile = await ensureProfileForAuthUser({ authUserId: user.id, displayName });

  return profile.id;
}

const createSchema = z.object({
  title: z.string().trim().max(160).default(""),
  count: z.coerce.number().refine((value) => (SIMULATION_QUESTION_COUNTS as readonly number[]).includes(value)),
  minutes: z
    .string()
    .default("")
    .transform((value) => (value === "" ? null : Number(value)))
    .refine((value) => (SIMULATION_TIME_LIMITS as readonly (number | null)[]).includes(value)),
});

/** Draws the questions from the explorer filters in the form and starts the exam. */
export async function createSimulationAction(formData: FormData): Promise<void> {
  const profileId = await requireProfileId();

  if (!profileId) {
    redirect("/login");
  }

  const parsed = createSchema.safeParse({
    title: formData.get("title") ?? "",
    count: formData.get("count") ?? "",
    minutes: formData.get("minutes") ?? "",
  });

  if (!parsed.success) {
    redirect("/app/simulados?erro=dados");
  }

  // The same URL parameters as the explorer (discipline, area, board, year…).
  const raw: Record<string, string> = {};

  for (const key of ["discipline", "area", "topic", "board", "org", "cargo", "year", "type", "situacao"]) {
    const value = formData.get(key);

    if (typeof value === "string" && value.trim()) {
      raw[key] = value;
    }
  }

  const { situation, ...filters } = parseQuestionExplorerSearchParams(raw).filters;
  const mine = situation ? QUESTION_EXPLORER_SITUATIONS[situation] : undefined;
  const repositoryFilters = {
    ...filters,
    ...(mine === "favorite"
      ? { favoriteOfProfileId: profileId }
      : mine
        ? { answered: { profileId, status: mine } }
        : {}),
  };

  // Answers are recorded when the exam is finished: free students need today's
  // remaining free answers for the whole exam up front.
  const allowance = await loadAnswerAllowance(profileId);
  if (allowance.remaining !== null && allowance.remaining < parsed.data.count) {
    redirect("/app/simulados?erro=limite");
  }

  const created = await createSimulation({
    profileId,
    title: parsed.data.title || `Simulado de ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    filters: repositoryFilters,
    filtersForDisplay: raw,
    questionCount: parsed.data.count,
    timeLimitMinutes: parsed.data.minutes,
  });

  if (!created) {
    redirect("/app/simulados?erro=sem-questoes");
  }

  redirect(`/app/simulados/${created.id}`);
}

const answerSchema = z.union([
  z.object({ type: z.literal("MULTIPLE_CHOICE"), alternativeId: z.uuid() }),
  z.object({ type: z.literal("TRUE_FALSE"), value: z.boolean() }),
  z.null(),
]);

export type SimulationActionResult = Readonly<{ ok: true }> | Readonly<{ ok: false; message: string }>;

export async function saveSimulationAnswerAction(
  simulationId: unknown,
  questionId: unknown,
  answer: unknown,
): Promise<SimulationActionResult> {
  const ids = z.object({ simulationId: z.uuid(), questionId: z.uuid() }).safeParse({ simulationId, questionId });
  const parsedAnswer = answerSchema.safeParse(answer);

  if (!ids.success || !parsedAnswer.success) {
    return { ok: false, message: "Resposta inválida." };
  }

  const profileId = await requireProfileId();

  if (!profileId) {
    return { ok: false, message: "Sua sessão expirou. Entre novamente." };
  }

  const outcome = await saveSimulationAnswer(profileId, ids.data.simulationId, ids.data.questionId, parsedAnswer.data);

  if (outcome === "saved") {
    return { ok: true };
  }

  return {
    ok: false,
    message: outcome === "closed" ? "O simulado já foi encerrado." : "Não foi possível salvar esta resposta.",
  };
}

export async function finishSimulationAction(simulationId: unknown): Promise<SimulationActionResult> {
  const id = z.uuid().safeParse(simulationId);

  if (!id.success) {
    return { ok: false, message: "Simulado inválido." };
  }

  const profileId = await requireProfileId();

  if (!profileId) {
    return { ok: false, message: "Sua sessão expirou. Entre novamente." };
  }

  const outcome = await finishSimulation(profileId, id.data);

  if (outcome === "not-found") {
    return { ok: false, message: "Simulado não encontrado." };
  }

  revalidatePath(`/app/simulados/${id.data}`);
  revalidatePath("/app/simulados");

  return { ok: true };
}

export type OfficialSimulationResult = Readonly<{ ok: true; id: string }> | Readonly<{ ok: false; message: string }>;

/**
 * Starts the official exam of a course: same questions per subject and same time as the real exam.
 * Allowed for administrators, Premium students and whoever has the course.
 */
export async function createOfficialSimulationAction(courseSlug: unknown): Promise<OfficialSimulationResult> {
  const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(120).safeParse(courseSlug);

  if (!slug.success) {
    return { ok: false, message: "Simulado inválido." };
  }

  const profileId = await requireProfileId();

  if (!profileId) {
    return { ok: false, message: "Sua sessão expirou. Entre novamente." };
  }

  const exam = await loadOfficialExam(slug.data);

  if (!exam) {
    return { ok: false, message: "Este simulado não está disponível." };
  }

  const allowed = (await hasPremiumAccess(profileId)) || (await hasCourseAccess(profileId, exam.courseId));

  if (!allowed) {
    return { ok: false, message: "O simulado oficial é do Premium e de quem tem o combo deste concurso." };
  }

  const created = await createOfficialSimulation(profileId, slug.data);

  if (!created) {
    return { ok: false, message: "O banco ainda não tem questões publicadas para montar este simulado." };
  }

  revalidatePath("/app/simulados");

  return { ok: true, id: created.id };
}
