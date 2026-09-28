import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { answerAllowance } from "@/modules/study/domain/access";
import { findStudentProfileId } from "@/modules/study/infrastructure/queries/answered-question-status";
import { loadAnswerAllowance } from "@/modules/study/infrastructure/queries/student-access";
import { loadVisitorAllowance } from "@/modules/study/infrastructure/visitors/visitor-usage";
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

  const cookieStore = await cookies();
  const theme = parseTheme(cookieStore.get(THEME_COOKIE)?.value);
  const fontScale = parseFontScale(cookieStore.get(FONT_SCALE_COOKIE)?.value);

  // Signed out: only the public question bank gets here (the proxy sends the
  // rest of /app to the login), shown in visitor mode.
  if (error || !user) {
    const visitor = await loadVisitorAllowance();

    return (
      <StudentAppShell
        displayName="Visitante"
        firstName="visitante"
        initialTheme={theme}
        initialFontScale={fontScale}
        plan={{ premium: false, visitor: true, remaining: visitor.remaining, limit: visitor.limit }}
      >
        {children}
      </StudentAppShell>
    );
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

  const profileId = await findStudentProfileId(user.id);
  const allowance = profileId ? await loadAnswerAllowance(profileId) : answerAllowance("free", 0);

  return (
    <StudentAppShell
      displayName={displayName}
      email={user.email}
      firstName={firstName}
      initialTheme={theme}
      initialFontScale={fontScale}
      plan={{ premium: allowance.plan === "premium", remaining: allowance.remaining, limit: allowance.limit }}
    >
      {children}
    </StudentAppShell>
  );
}
