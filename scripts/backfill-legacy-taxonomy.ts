import "dotenv/config";

import {
  mkdir,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";

import { resolveLegacyBackfillRules } from "../src/modules/taxonomy/application/legacy-enem-taxonomy-backfill";
import {
  applyLegacyBackfillPlan,
  buildLegacyBackfillPlan,
  loadTaxonomyIdLookup,
} from "../src/modules/taxonomy/infrastructure/prisma-legacy-taxonomy-backfill";
import { getPrismaClient } from "../src/shared/infrastructure/database/prisma";

/*
 * Moves questions out of the legacy ENEM disciplines using only
 * deterministic signals, and fills question.knowledgeAreaId.
 * Never changes status, topics or publication.
 *
 *   npm run taxonomy:backfill-legacy            # dry-run
 *   npm run taxonomy:backfill-legacy -- --apply # writes, after saving
 *                                               # a reversal log
 */

const REVERSAL_LOG_DIRECTORY = resolve("data-private", "backfills");

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing from the environment.");
  }

  const apply = process.argv.slice(2).includes("--apply");
  const prisma = getPrismaClient();

  try {
    const rules = resolveLegacyBackfillRules(
      await loadTaxonomyIdLookup(prisma),
    );

    if (rules.problems.length > 0) {
      console.error(JSON.stringify({ problems: rules.problems }, null, 2));
      process.exitCode = 1;
      return;
    }

    const plan = await buildLegacyBackfillPlan(prisma, rules);

    const summary = {
      mode: apply ? "apply" : "dry-run",
      disciplineMoves: Object.fromEntries(
        plan.moves.map(({ rule, changes }) => [rule.code, changes.length]),
      ),
      knowledgeAreaFills: Object.fromEntries(
        plan.fills.map(({ rule, changes }) => [rule.legacySlug, changes.length]),
      ),
    };

    console.log(JSON.stringify(summary, null, 2));

    const changes = [
      ...plan.moves.flatMap((move) => move.changes),
      ...plan.fills.flatMap((fill) => fill.changes),
    ];

    if (changes.length === 0) {
      console.log("Nothing to change.");
      return;
    }

    if (!apply) {
      console.log("Dry-run only. Re-run with --apply to write.");
      return;
    }

    await mkdir(REVERSAL_LOG_DIRECTORY, { recursive: true });

    const logPath = resolve(
      REVERSAL_LOG_DIRECTORY,
      `legacy-taxonomy-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    );

    await writeFile(
      logPath,
      JSON.stringify({ createdAt: new Date().toISOString(), summary, changes }, null, 2),
      "utf8",
    );

    console.log(`Reversal log written to ${logPath}`);

    await applyLegacyBackfillPlan(prisma, plan);

    console.log("LEGACY TAXONOMY BACKFILL APPLIED");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
