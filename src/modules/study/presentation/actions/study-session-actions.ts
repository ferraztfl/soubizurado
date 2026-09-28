"use server";

import { redirect } from "next/navigation";

import { ensureProfileForAuthUser } from "@/modules/identity/application/ensure-profile";
import {
  isStudySessionMode,
  STUDY_SESSION_MODES,
  STUDY_SESSION_SIZES,
} from "@/modules/study/domain/study-session";
import { todayInSaoPaulo } from "@/modules/study/infrastructure/queries/study-preferences";
import { createStudySession } from "@/modules/study/infrastructure/sessions/study-session-store";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Starts a guided study session from the "Estudar" form and opens it. */
export async function createStudySessionAction(formData: FormData): Promise<void> {
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

  const mode = readString(formData, "mode");
  const size = Number(readString(formData, "size"));

  if (!isStudySessionMode(mode) || !(STUDY_SESSION_SIZES as readonly number[]).includes(size)) {
    redirect("/app/estudar?error=invalido");
  }

  const disciplineInput = readString(formData, "disciplineId");
  const areaInput = readString(formData, "areaId");
  const prisma = getPrismaClient();

  // Only catalog ids; the area must belong to the chosen discipline.
  const discipline = UUID.test(disciplineInput)
    ? await prisma.discipline.findFirst({ where: { id: disciplineInput, isActive: true }, select: { id: true, name: true } })
    : null;
  const area =
    discipline && UUID.test(areaInput)
      ? await prisma.area.findFirst({ where: { id: areaInput, disciplineId: discipline.id, isActive: true }, select: { id: true, name: true } })
      : null;

  const title = [STUDY_SESSION_MODES[mode], discipline?.name ?? "Todas as matérias", area?.name].filter(Boolean).join(" · ");

  const session = await createStudySession({
    profileId: profile.id,
    mode,
    size,
    today: todayInSaoPaulo(),
    title,
    disciplineId: discipline?.id ?? null,
    areaId: area?.id ?? null,
    filtersForDisplay: { discipline: discipline?.name ?? null, area: area?.name ?? null },
  });

  if (!session) {
    redirect(`/app/estudar?error=${mode === "REVIEW" ? "sem-revisoes" : "sem-questoes"}`);
  }

  redirect(`/app/estudar/${session.id}`);
}
