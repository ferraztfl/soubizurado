import "dotenv/config";

import {
  getPrismaClient,
} from "../src/shared/infrastructure/database/prisma";

async function main(): Promise<void> {
  const prisma = getPrismaClient();

  const profiles =
    await prisma.profile.findMany({
      orderBy: [
        {
          displayName: "asc",
        },
        {
          id: "asc",
        },
      ],
      select: {
        id: true,
        displayName: true,
        roles: {
          orderBy: {
            role: "asc",
          },
          select: {
            role: true,
          },
        },
      },
    });

  process.stdout.write(
    `${JSON.stringify(
      profiles.map((profile) => ({
        profileId: profile.id,
        displayName:
          profile.displayName,
        roles:
          profile.roles.map(
            (item) => item.role,
          ),
      })),
      null,
      2,
    )}\n`,
  );
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : "Unknown profile listing error.";

  process.stderr.write(
    `Profile listing failed: ${message}\n`,
  );
  process.exitCode = 1;
});
