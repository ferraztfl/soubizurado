import "dotenv/config";

import { randomUUID } from "node:crypto";

import {
  buildTaxonomySeedPlan,
  countSeedPlan,
} from "../src/modules/taxonomy/application/build-taxonomy-seed-plan";
import {
  countCatalog,
  validateCanonicalTaxonomyCatalog,
} from "../src/modules/taxonomy/domain/canonical-taxonomy-catalog";
import { CANONICAL_TAXONOMY } from "../src/modules/taxonomy/infrastructure/catalog/canonical-taxonomy";
import {
  applyTaxonomySeedPlan,
  loadTaxonomySnapshot,
} from "../src/modules/taxonomy/infrastructure/prisma-taxonomy-seed-repository";
import { getPrismaClient } from "../src/shared/infrastructure/database/prisma";

/*
 * Seeds the canonical taxonomy catalog. Create-only and idempotent.
 *
 *   npm run taxonomy:seed            # dry-run: prints the plan
 *   npm run taxonomy:seed -- --apply # writes it in one transaction
 */

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing from the environment.");
  }

  const apply = process.argv.slice(2).includes("--apply");
  const catalog = CANONICAL_TAXONOMY;

  const catalogIssues = validateCanonicalTaxonomyCatalog(catalog);

  if (catalogIssues.length > 0) {
    console.error(JSON.stringify({ catalogIssues }, null, 2));
    process.exitCode = 1;
    return;
  }

  const prisma = getPrismaClient();

  try {
    const snapshot = await loadTaxonomySnapshot(prisma);
    const plan = buildTaxonomySeedPlan(catalog, snapshot, randomUUID);

    console.log(
      JSON.stringify(
        {
          mode: apply ? "apply" : "dry-run",
          catalogVersion: catalog.version,
          catalog: countCatalog(catalog),
          toCreate: countSeedPlan(plan),
          revision: plan.revision?.version ?? null,
          conflicts: plan.conflicts,
        },
        null,
        2,
      ),
    );

    if (plan.conflicts.length > 0) {
      console.error("Conflicts found; nothing was written.");
      process.exitCode = 1;
      return;
    }

    if (!apply) {
      console.log("Dry-run only. Re-run with --apply to write.");
      return;
    }

    await applyTaxonomySeedPlan(prisma, plan, null);
    console.log("TAXONOMY SEED APPLIED");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
