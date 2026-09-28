import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

type EnsureProfileInput = {
  authUserId: string;
  displayName?: string | null;
};

export async function ensureProfileForAuthUser(
  input: EnsureProfileInput,
) {
  const prisma = getPrismaClient();

  // Fast path (every page view): one read, no write transaction, when the
  // profile, its student role and its name are already up to date. Holding a
  // transaction per render exhausted the small connection pool.
  const existing = await prisma.profile.findFirst({
    where: { authUserId: input.authUserId, roles: { some: { role: "STUDENT" } } },
  });

  if (existing && (!input.displayName || existing.displayName === input.displayName)) {
    return existing;
  }

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