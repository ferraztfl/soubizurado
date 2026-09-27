import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";

import {
  FONT_SCALE_COOKIE,
  parseFontScale,
  parseTheme,
  THEME_COOKIE,
} from "./_components/reading-preferences";
import { StudentAppShell } from "./_components/student-app-shell";

type StudentAppLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function StudentAppLayout({
  children,
}: StudentAppLayoutProps) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const metadataDisplayName =
    typeof user.user_metadata.display_name === "string"
      ? user.user_metadata.display_name
      : null;

  const displayName =
    metadataDisplayName ??
    user.email ??
    "Aluno";

  const firstName =
    displayName.trim().split(/\s+/)[0] || "Aluno";

  const cookieStore = await cookies();

  return (
    <StudentAppShell
      displayName={displayName}
      email={user.email}
      firstName={firstName}
      initialTheme={parseTheme(cookieStore.get(THEME_COOKIE)?.value)}
      initialFontScale={parseFontScale(cookieStore.get(FONT_SCALE_COOKIE)?.value)}
    >
      {children}
    </StudentAppShell>
  );
}
