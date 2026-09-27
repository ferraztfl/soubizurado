import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { getPrismaClient } from "../src/shared/infrastructure/database/prisma";

/*
 * Every ENEM multiple-choice question has five alternatives (A–E). Legacy
 * imports lost some of them, which can leave the answer key pointing at the
 * wrong option (e.g. Q102816). This moves published ENEM multiple-choice
 * questions with fewer than five alternatives back to review until they are
 * rebuilt from the official INEP booklets.
 *
 *   npm run questions:unpublish-incomplete-enem            # dry-run
 *   npm run questions:unpublish-incomplete-enem -- --apply # writes, after a reversal log
 */

const ENEM_ALTERNATIVES = 5;

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const prisma = getPrismaClient();

  try {
    const questions = await prisma.question.findMany({
      where: {
        status: "PUBLISHED",
        type: "MULTIPLE_CHOICE",
        examination: { is: { title: { startsWith: "ENEM" } } },
      },
      select: {
        id: true,
        publicNumber: true,
        publishedAt: true,
        alternatives: { orderBy: { position: "asc" }, select: { label: true, isCorrect: true } },
      },
    });

    const incomplete = questions.filter((question) => question.alternatives.length < ENEM_ALTERNATIVES);

    console.log(`Published ENEM multiple choice: ${questions.length}. With fewer than 5 alternatives: ${incomplete.length}.`);

    for (const question of incomplete) {
      const letters = question.alternatives.map((item) => item.label + (item.isCorrect ? "*" : "")).join(" ");
      console.log(`  Q${question.publicNumber}  ${letters}`);
    }

    if (!apply || incomplete.length === 0) {
      if (!apply) console.log("Dry-run only. Re-run with --apply to move them back to review.");
      return;
    }

    const directory = resolve("data-private", "publications");
    await mkdir(directory, { recursive: true });
    const logPath = resolve(directory, `unpublish-incomplete-enem-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await writeFile(
      logPath,
      JSON.stringify(
        {
          undo: "UPDATE questions SET status='PUBLISHED', published_at=<publishedAt> WHERE id=<id> (per row)",
          questions: incomplete.map((question) => ({
            id: question.id,
            code: `Q${question.publicNumber}`,
            publishedAt: question.publishedAt,
          })),
        },
        null,
        2,
      ),
      "utf8",
    );
    console.log(`Reversal log: ${logPath}`);

    const result = await prisma.question.updateMany({
      where: { id: { in: incomplete.map((question) => question.id) }, status: "PUBLISHED" },
      data: { status: "IN_REVIEW", publishedAt: null },
    });

    console.log(`Moved ${result.count} question(s) back to review.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
