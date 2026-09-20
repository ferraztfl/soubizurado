import "dotenv/config";

import {
  getPrismaClient,
} from "../src/shared/infrastructure/database/prisma";

function argumentValue(
  name: string,
): string | undefined {
  const prefix = `--${name}=`;

  return process.argv
    .slice(2)
    .find((argument) =>
      argument.startsWith(prefix),
    )
    ?.slice(prefix.length)
    .trim();
}

async function main(): Promise<void> {
  const profileId =
    argumentValue("profile");
  const role =
    argumentValue("role");

  if (!profileId) {
    throw new Error(
      "--profile=<uuid> is required.",
    );
  }

  if (
    role !== "ADMIN" &&
    role !== "EDITOR"
  ) {
    throw new Error(
      "--role must be ADMIN or EDITOR.",
    );
  }

  const prisma = getPrismaClient();

  const profile =
    await prisma.profile.findUnique({
      where: {
        id: profileId,
      },
      select: {
        id: true,
        displayName: true,
      },
    });

  if (!profile) {
    throw new Error(
      `Profile ${profileId} was not found.`,
    );
  }

  await prisma.userRole.upsert({
    where: {
      profileId_role: {
        profileId,
        role,
      },
    },
    update: {},
    create: {
      profileId,
      role,
    },
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        profileId:
          profile.id,
        displayName:
          profile.displayName,
        grantedRole: role,
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : "Unknown role grant error.";

  process.stderr.write(
    `Role grant failed: ${message}\n`,
  );
  process.exitCode = 1;
});
