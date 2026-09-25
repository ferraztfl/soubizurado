import "dotenv/config";

import { getPrismaClient } from "../src/shared/infrastructure/database/prisma";

/*
 * Read-only summary of the classification queue.
 *
 *   npm run classification:status
 */

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing from the environment.");
  }

  const prisma = getPrismaClient();

  try {
    const [byStatus, withTopic, applied, recentFailures] = await Promise.all([
      prisma.questionClassificationTask.groupBy({
        by: ["classifierVersion", "taxonomyVersion", "status"],
        _count: { _all: true },
        orderBy: [{ classifierVersion: "asc" }, { taxonomyVersion: "asc" }],
      }),
      prisma.questionClassificationTask.count({
        where: { suggestedTopicId: { not: null } },
      }),
      prisma.questionClassificationTask.count({
        where: { appliedAt: { not: null } },
      }),
      prisma.questionClassificationTask.findMany({
        where: { status: "FAILED" },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, questionId: true, attempts: true, errorMessage: true },
      }),
    ]);

    console.log(
      JSON.stringify(
        {
          byStatus: byStatus.map((row) => ({
            classifierVersion: row.classifierVersion,
            taxonomyVersion: row.taxonomyVersion,
            status: row.status,
            count: row._count._all,
          })),
          suggestionsWithTopic: withTopic,
          applied,
          recentFailures,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
