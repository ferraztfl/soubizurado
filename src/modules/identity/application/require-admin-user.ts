import { redirect } from "next/navigation";

import { getPrismaClient } from "@/shared/infrastructure/database/prisma";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";

import { ensureProfileForAuthUser } from "./ensure-profile";

export type RequiredAdminUser =
  Readonly<{
    authUserId: string;
    profileId: string;
    email: string;
  }>;

function normalizeEmail(
  value: string | null | undefined,
): string | null {
  const normalized =
    value
      ?.trim()
      .toLocaleLowerCase(
        "en-US",
      ) ?? "";

  return normalized ||
    null;
}

export function isBootstrapAdminCandidate(
  input: Readonly<{
    configuredEmail:
      | string
      | null
      | undefined;
    userEmail:
      | string
      | null
      | undefined;
    emailConfirmed: boolean;
  }>,
): boolean {
  const configuredEmail =
    normalizeEmail(
      input.configuredEmail,
    );

  const userEmail =
    normalizeEmail(
      input.userEmail,
    );

  return (
    input.emailConfirmed &&
    configuredEmail !== null &&
    userEmail !== null &&
    configuredEmail ===
      userEmail
  );
}

export async function requireAdminUser():
  Promise<RequiredAdminUser> {
  const supabase =
    await createSupabaseServerClient();

  const {
    data: {
      user,
    },
    error,
  } =
    await supabase.auth.getUser();

  if (
    error ||
    !user
  ) {
    redirect("/login");
  }

  const email =
    normalizeEmail(
      user.email,
    );

  if (!email) {
    redirect("/app");
  }

  const metadataDisplayName =
    typeof user.user_metadata
      .display_name ===
    "string"
      ? user.user_metadata
          .display_name
      : null;

  const profile =
    await ensureProfileForAuthUser({
      authUserId:
        user.id,
      displayName:
        metadataDisplayName,
    });

  const prisma =
    getPrismaClient();

  const existingAdminRole =
    await prisma.userRole.findUnique({
      where: {
        profileId_role: {
          profileId:
            profile.id,
          role:
            "ADMIN",
        },
      },

      select: {
        id: true,
      },
    });

  if (existingAdminRole) {
    return {
      authUserId:
        user.id,
      profileId:
        profile.id,
      email,
    };
  }

  const canBootstrap =
    isBootstrapAdminCandidate({
      configuredEmail:
        process.env
          .SOUBIZURADO_ADMIN_EMAIL,

      userEmail:
        email,

      emailConfirmed:
        Boolean(
          user.email_confirmed_at,
        ),
    });

  if (!canBootstrap) {
    redirect("/app");
  }

  await prisma.userRole.upsert({
    where: {
      profileId_role: {
        profileId:
          profile.id,
        role:
          "ADMIN",
      },
    },

    update: {},

    create: {
      profileId:
        profile.id,
      role:
        "ADMIN",
    },
  });

  return {
    authUserId:
      user.id,
    profileId:
      profile.id,
    email,
  };
}