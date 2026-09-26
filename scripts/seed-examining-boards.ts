import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  EXAMINING_BOARD_CATALOG,
  examiningBoardSlug,
} from "../src/modules/question-bank/domain/examining-board-catalog";
import { getPrismaClient } from "../src/shared/infrastructure/database/prisma";

/*
 * Seeds the canonical examining boards and links ENEM examinations to
 * INEP.
 *
 *   npm run boards:seed             # dry-run, prints the plan
 *   npm run boards:seed -- --apply  # writes, after saving a reversal log
 *
 * Existing boards are never renamed: only a missing acronym or website
 * is filled in. ENEM examinations are linked only when they have no
 * board and their organization is INEP.
 */

const REVERSAL_LOG_DIRECTORY = resolve("data-private", "backfills");

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing from the environment.");
  }

  const apply = process.argv.slice(2).includes("--apply");
  const prisma = getPrismaClient();

  try {
    const existing = await prisma.examiningBoard.findMany({
      select: { id: true, slug: true, name: true, acronym: true, websiteUrl: true },
    });
    const bySlug = new Map(existing.map((board) => [board.slug, board]));

    type BoardFill = { acronym?: string; websiteUrl?: string };
    type ExistingBoard = (typeof existing)[number];

    const toCreate: { slug: string; name: string; acronym: string; websiteUrl: string | null }[] = [];
    const toFill: { id: string; slug: string; before: ExistingBoard; fill: BoardFill }[] = [];

    for (const entry of EXAMINING_BOARD_CATALOG) {
      const slug = examiningBoardSlug(entry.name);
      const current = bySlug.get(slug);

      if (!current) {
        toCreate.push({ slug, name: entry.name, acronym: entry.acronym, websiteUrl: entry.websiteUrl });
        continue;
      }

      const fill: BoardFill = {
        ...(current.acronym ? {} : { acronym: entry.acronym }),
        ...(current.websiteUrl || !entry.websiteUrl ? {} : { websiteUrl: entry.websiteUrl }),
      };

      if (Object.keys(fill).length > 0) {
        toFill.push({ id: current.id, slug, before: current, fill });
      }
    }

    const enemExaminations = await prisma.examination.findMany({
      where: {
        boardId: null,
        title: { startsWith: "ENEM " },
        organization: { name: "INEP" },
      },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    });

    console.log(
      JSON.stringify(
        {
          mode: apply ? "apply" : "dry-run",
          create: toCreate.map((board) => board.name),
          fill: toFill.map((board) => ({ slug: board.slug, ...board.fill })),
          enemExaminationsToLinkToInep: enemExaminations.map((examination) => examination.title),
        },
        null,
        2,
      ),
    );

    if (!apply) {
      console.log("Dry-run only. Re-run with --apply to write.");
      return;
    }

    await mkdir(REVERSAL_LOG_DIRECTORY, { recursive: true });
    const logPath = resolve(
      REVERSAL_LOG_DIRECTORY,
      `examining-boards-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    );

    await writeFile(
      logPath,
      JSON.stringify(
        {
          createdSlugs: toCreate.map((board) => board.slug),
          filledBoards: toFill.map((board) => board.before),
          enemExaminationIdsLinked: enemExaminations.map((examination) => examination.id),
          undo:
            "Set board_id = NULL for enemExaminationIdsLinked; restore acronym/website_url of filledBoards; delete createdSlugs not referenced by examinations.",
        },
        null,
        2,
      ),
      "utf8",
    );
    console.log(`Reversal log: ${logPath}`);

    await prisma.$transaction(async (transaction) => {
      for (const board of toCreate) {
        await transaction.examiningBoard.create({ data: board });
      }

      for (const board of toFill) {
        await transaction.examiningBoard.update({ where: { id: board.id }, data: board.fill });
      }

      if (enemExaminations.length > 0) {
        const inep = await transaction.examiningBoard.findUniqueOrThrow({
          where: { slug: examiningBoardSlug("INEP") },
          select: { id: true },
        });

        await transaction.examination.updateMany({
          where: { id: { in: enemExaminations.map((examination) => examination.id) }, boardId: null },
          data: { boardId: inep.id },
        });
      }
    });

    console.log("Applied.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
