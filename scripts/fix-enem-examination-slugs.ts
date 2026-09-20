import "dotenv/config";

import {
  getPrismaClient,
} from "../src/shared/infrastructure/database/prisma";

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing from the environment.",
    );
  }

  const prisma = getPrismaClient();

  const legacyExams =
    await prisma.examination.findMany({
      where: {
        slug: {
          startsWith:
            "enem-enem-",
        },
      },
      orderBy: {
        year: "asc",
      },
      select: {
        id: true,
        title: true,
        year: true,
        slug: true,
      },
    });

  const changes: Array<{
    id: string;
    year: number | null;
    from: string;
    to: string;
  }> = [];

  for (const exam of legacyExams) {
    const targetSlug =
      exam.slug.replace(
        /^enem-enem-/,
        "enem-",
      );

    const conflicting =
      await prisma.examination.findUnique({
        where: {
          slug: targetSlug,
        },
        select: {
          id: true,
        },
      });

    if (
      conflicting &&
      conflicting.id !== exam.id
    ) {
      throw new Error(
        `Cannot normalize ${exam.slug}: ${targetSlug} already belongs to examination ${conflicting.id}.`,
      );
    }

    await prisma.examination.update({
      where: {
        id: exam.id,
      },
      data: {
        slug: targetSlug,
      },
    });

    changes.push({
      id: exam.id,
      year: exam.year,
      from: exam.slug,
      to: targetSlug,
    });
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        changed: changes.length,
        changes,
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
      : "Unknown ENEM slug maintenance error.";

  process.stderr.write(
    `ENEM slug maintenance failed: ${message}\n`,
  );
  process.exitCode = 1;
});
