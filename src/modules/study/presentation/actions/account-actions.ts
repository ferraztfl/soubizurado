"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ensureProfileForAuthUser } from "@/modules/identity/application/ensure-profile";
import { planStudyGoals } from "@/modules/study/domain/study-preferences";
import { todayInSaoPaulo } from "@/modules/study/infrastructure/queries/study-preferences";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";

/*
 * Perfil and Configurações. Every action re-checks the session and only
 * touches the signed-in student's own profile and preferences.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireStudent() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const displayName = typeof user.user_metadata.display_name === "string" ? user.user_metadata.display_name : null;
  const profile = await ensureProfileForAuthUser({ authUserId: user.id, displayName });

  return { supabase, user, profileId: profile.id };
}

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

const nameSchema = z.string().trim().min(2).max(120);

/** Name and study goals (Perfil). */
export async function saveProfileAction(formData: FormData): Promise<void> {
  const { supabase, profileId } = await requireStudent();

  const name = nameSchema.safeParse(readString(formData, "displayName"));
  if (!name.success) {
    redirect("/app/perfil?error=nome");
  }

  const boardId = readString(formData, "targetBoardId");
  const goals = planStudyGoals({
    dailyGoal: readString(formData, "dailyGoal"),
    targetExam: readString(formData, "targetExam"),
    targetBoardId: UUID.test(boardId) ? boardId : null,
    targetExamDate: readString(formData, "targetExamDate"),
    today: todayInSaoPaulo(),
  });

  if (!goals.ok) {
    redirect(`/app/perfil?error=${goals.error === "EXAM_DATE_INVALID" ? "data" : goals.error === "DAILY_GOAL_INVALID" ? "meta" : "concurso"}`);
  }

  const prisma = getPrismaClient();
  const board = goals.goals.targetBoardId
    ? await prisma.examiningBoard.findFirst({ where: { id: goals.goals.targetBoardId, isActive: true }, select: { id: true } })
    : null;
  const data = {
    dailyGoal: goals.goals.dailyGoal,
    targetExam: goals.goals.targetExam,
    targetBoardId: board?.id ?? null,
    targetExamDate: goals.goals.targetExamDate ? new Date(`${goals.goals.targetExamDate}T00:00:00Z`) : null,
  };

  await prisma.$transaction([
    prisma.profile.update({ where: { id: profileId }, data: { displayName: name.data } }),
    prisma.studyPreference.upsert({ where: { profileId }, update: data, create: { profileId, ...data } }),
  ]);

  // The session metadata name is shown in the app shell; keep it in sync.
  await supabase.auth.updateUser({ data: { display_name: name.data } });

  revalidatePath("/app", "layout");
  redirect("/app/perfil?ok=1");
}

/** Whether the student appears in the ranking (Configurações). */
export async function saveRankingVisibilityAction(formData: FormData): Promise<void> {
  const { profileId } = await requireStudent();
  const showInRanking = formData.get("showInRanking") === "on";

  await getPrismaClient().studyPreference.upsert({
    where: { profileId },
    update: { showInRanking },
    create: { profileId, showInRanking },
  });

  revalidatePath("/app/configuracoes");
  redirect("/app/configuracoes?ok=privacidade");
}

const passwordSchema = z.string().min(8).max(128);

/** Changes the password after confirming the current one. */
export async function changePasswordAction(formData: FormData): Promise<void> {
  const { supabase, user } = await requireStudent();

  const current = readString(formData, "currentPassword");
  const next = passwordSchema.safeParse(readString(formData, "newPassword"));

  if (!next.success) {
    redirect("/app/configuracoes?error=senha-curta");
  }

  if (next.data !== readString(formData, "confirmPassword")) {
    redirect("/app/configuracoes?error=senha-diferente");
  }

  if (!user.email) {
    redirect("/app/configuracoes?error=senha-falhou");
  }

  const check = await supabase.auth.signInWithPassword({ email: user.email, password: current });

  if (check.error) {
    redirect("/app/configuracoes?error=senha-atual");
  }

  const { error } = await supabase.auth.updateUser({ password: next.data });

  if (error) {
    redirect("/app/configuracoes?error=senha-falhou");
  }

  redirect("/app/configuracoes?ok=senha");
}

/** Ends every session of the account (all devices), including this one. */
export async function signOutEverywhereAction(): Promise<void> {
  const { supabase } = await requireStudent();

  await supabase.auth.signOut({ scope: "global" });
  redirect("/login");
}
