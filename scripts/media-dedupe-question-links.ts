import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { getPrismaClient } from "../src/shared/infrastructure/database/prisma";

/*
 * Removes repeated links of the same media asset to the same question
 * (QUESTION_ATTACHMENT). Legacy ENEM imports lifted inline symbols (N1, Δ…)
 * out of the text, so a symbol used twice became two links to one asset.
 * The first link (lowest position) is kept, so no image disappears.
 *
 *   npm run media:dedupe-links            # dry-run
 *   npm run media:dedupe-links -- --apply # writes, after a reversal log
 */

type LinkRow = Readonly<{
  id: string;
  questionId: string;
  mediaAssetId: string;
  role: string;
  position: number;
}>;

async function main() {
  const apply = process.argv.includes("--apply");
  const prisma = getPrismaClient();

  const links = await prisma.questionMediaLink.findMany({
    where: { role: "QUESTION_ATTACHMENT" },
    orderBy: [{ questionId: "asc" }, { position: "asc" }],
    select: { id: true, questionId: true, mediaAssetId: true, role: true, position: true },
  });

  const seen = new Set<string>();
  const extra: LinkRow[] = [];

  for (const link of links) {
    const key = `${link.questionId}:${link.mediaAssetId}`;

    if (seen.has(key)) {
      extra.push(link);
    } else {
      seen.add(key);
    }
  }

  const questions = await prisma.question.findMany({
    where: { id: { in: [...new Set(extra.map((link) => link.questionId))] } },
    select: { id: true, publicNumber: true },
  });
  const codeOf = new Map(questions.map((question) => [question.id, `Q${question.publicNumber}`]));

  console.log(`Repeated links: ${extra.length} in ${codeOf.size} question(s).`);

  for (const link of extra) {
    console.log(`  ${codeOf.get(link.questionId)} asset=${link.mediaAssetId} position=${link.position}`);
  }

  if (!apply || extra.length === 0) {
    if (!apply) console.log("Dry-run only. Re-run with --apply to remove them.");
    await prisma.$disconnect();
    return;
  }

  const directory = resolve("data-private", "media-dedupe");
  await mkdir(directory, { recursive: true });
  const logPath = resolve(directory, `question-media-links-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  // Reversal: re-create these rows (same ids, question, asset, role, position).
  await writeFile(logPath, JSON.stringify({ removedAt: new Date().toISOString(), links: extra }, null, 2));
  console.log(`Reversal log: ${logPath}`);

  const result = await prisma.questionMediaLink.deleteMany({
    where: { id: { in: extra.map((link) => link.id) } },
  });

  console.log(`Removed ${result.count} link(s).`);
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
