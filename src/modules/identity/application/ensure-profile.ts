import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

type EnsureProfileInput = {
  authUserId: string;
  displayName?: string | null;
};

export async function ensureProfileForAuthUser(
  input: EnsureProfileInput,
) {
  const prisma = getPrismaClient();

  return prisma.$transaction(async (transaction) => {
    const profile = await transaction.profile.upsert({
      where: {
        authUserId: input.authUserId,
      },

      update: input.displayName
        ? {
            displayName: input.displayName,
          }
        : {},

      create: {
        authUserId: input.authUserId,
        displayName: input.displayName ?? null,
      },
    });

    await transaction.userRole.upsert({
      where: {
        profileId_role: {
          profileId: profile.id,
          role: "STUDENT",
        },
      },

      update: {},

      create: {
        profileId: profile.id,
        role: "STUDENT",
      },
    });

    return profile;
  });
}