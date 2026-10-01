import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { formatBRL } from "@/modules/store/domain/store";
import { DEFAULT_SUBSCRIPTION_PLAN, SUBSCRIPTION_PLANS, pricePerDayCents } from "@/modules/store/domain/subscription";
import { answerAllowance } from "@/modules/study/domain/access";
import { findStudentProfileId } from "@/modules/study/infrastructure/queries/answered-question-status";
import { loadAnswerAllowance } from "@/modules/study/infrastructure/queries/student-access";
import { loadVisitorAllowance } from "@/modules/study/infrastructure/visitors/visitor-usage";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";

import {
  FONT_SCALE_COOKIE,
  parseFontScale,
  parseSidebarCollapsed,
  parseTheme,
  SIDEBAR_COOKIE,
  THEME_COOKIE,
} from "./_components/reading-preferences";
import { StudentAppShell } from "./_components/student-app-shell";
import { VisitorAppShell } from "./_components/visitor-app-shell";
import { PremiumBar } from "../_components/premium-bar";
import { SiteFooter } from "../_components/site-footer";
import { SiteHeader } from "../_components/site-header";

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
  const sidebarCollapsed = parseSidebarCollapsed(cookieStore.get(SIDEBAR_COOKIE)?.value);

  // Signed out: only the public question bank gets here (the proxy sends the
  // rest of /app to the login), shown in visitor mode.
  if (error || !user) {
    const visitor = await loadVisitorAllowance();

    // Same header, footer and Premium bar as the rest of the public site.
    return (
      <VisitorAppShell
        header={<SiteHeader signedIn={false} />}
        footer={<SiteFooter />}
        bottomBar={
          <PremiumBar
            price={formatBRL(SUBSCRIPTION_PLANS[DEFAULT_SUBSCRIPTION_PLAN].amountCents)}
            perDay={formatBRL(pricePerDayCents(DEFAULT_SUBSCRIPTION_PLAN))}
          />
        }
        initialTheme={theme}
        initialFontScale={fontScale}
        plan={{ premium: false, visitor: true, remaining: visitor.remaining, limit: visitor.limit }}
      >
        {children}
      </VisitorAppShell>
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
      initialSidebarCollapsed={sidebarCollapsed}
      plan={{ premium: allowance.plan === "premium", remaining: allowance.remaining, limit: allowance.limit }}
    >
      {children}
    </StudentAppShell>
  );
}
