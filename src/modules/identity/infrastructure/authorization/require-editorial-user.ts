import { redirect } from "next/navigation";

import {
  getPrismaClient,
} from "@/shared/infrastructure/database/prisma";
import {
  createSupabaseServerClient,
} from "@/shared/infrastructure/supabase/server";

const EDITORIAL_ROLES = new Set([
  "ADMIN",
  "EDITOR",
]);

export type EditorialUser = Readonly<{
  profileId: string;
  authUserId: string;
  displayName: string;
  roles: readonly ("ADMIN" | "EDITOR")[];
}>;

export async function requireEditorialUser(): Promise<EditorialUser> {
  const supabase =
    await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const prisma = getPrismaClient();

  const profile =
    await prisma.profile.findUnique({
      where: {
        authUserId: user.id,
      },
      select: {
        id: true,
        displayName: true,
        roles: {
          select: {
            role: true,
          },
        },
      },
    });

  if (!profile) {
    redirect("/app");
  }

  const roles = profile.roles
    .map((item) => item.role)
    .filter(
      (
        role,
      ): role is "ADMIN" | "EDITOR" =>
        EDITORIAL_ROLES.has(role),
    );

  if (roles.length === 0) {
    redirect("/app");
  }

  return {
    profileId: profile.id,
    authUserId: user.id,
    displayName:
      profile.displayName ??
      user.email ??
      "Equipe editorial",
    roles,
  };
}
