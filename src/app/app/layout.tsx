import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { ensureProfileForAuthUser } from "@/modules/identity/application/ensure-profile";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";

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

  const profile = await ensureProfileForAuthUser({
    authUserId: user.id,
    displayName: metadataDisplayName,
  });

  const displayName =
    profile.displayName ??
    user.email ??
    "Aluno";

  const firstName =
    displayName.trim().split(/\s+/)[0] || "Aluno";

  return (
    <StudentAppShell
      displayName={displayName}
      email={user.email}
      firstName={firstName}
    >
      {children}
    </StudentAppShell>
  );
}
