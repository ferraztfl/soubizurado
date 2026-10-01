import "dotenv/config";

import { getPrismaClient } from "../src/shared/infrastructure/database/prisma";

/*
 * Lists the taxonomy entries created by administrators on the review screen
 * (admin audit log, action "taxonomy.create"), so they can be copied into the
 * canonical catalog. The database already has them; the catalog only matters
 * if the database is ever rebuilt from the code. Read-only.
 *
 *   npm run taxonomy:export-manual
 */

async function main(): Promise<void> {
  const prisma = getPrismaClient();

  try {
    const logs = await prisma.adminAuditLog.findMany({
      where: { action: "taxonomy.create" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, details: true, actor: { select: { displayName: true } } },
    });

    console.log(
      JSON.stringify(
        logs.map((log) => ({ at: log.createdAt.toISOString(), by: log.actor?.displayName ?? null, ...(log.details as object) })),
        null,
        2,
      ),
    );
    console.error(`${logs.length} criações manuais.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
