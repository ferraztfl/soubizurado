import "dotenv/config";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { parsePositionLines } from "../src/modules/contests/domain/contest";
import { getPrismaClient } from "../src/shared/infrastructure/database/prisma";

/*
 * Adds details to existing contests (positions, fee, stages, exam places,
 * authorization act) from a reviewed JSON in data-private/editorial.
 * Only the fields present in the file change; positions are replaced.
 *
 *   npm run editorial:enrich -- data-private/editorial/<file>.json          # dry-run
 *   npm run editorial:enrich -- data-private/editorial/<file>.json --apply  # writes + reversal log
 */

type Enrichment = {
  slug: string;
  feeText?: string;
  stages?: string[];
  examLocations?: string;
  authorization?: string;
  positions?: string[];
};

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing from the environment.");

  const file = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  if (!file) throw new Error("Informe o arquivo JSON (data-private/editorial/...).");
  const apply = process.argv.includes("--apply");

  const rows = (JSON.parse(await readFile(resolve(file), "utf8")) as { contests: Enrichment[] }).contests;
  const prisma = getPrismaClient();

  try {
    const contests = await prisma.contest.findMany({
      where: { slug: { in: rows.map((row) => row.slug) } },
      include: { contestPositions: { orderBy: { sortOrder: "asc" } } },
    });
    const problems: string[] = [];

    const plans = rows.map((row) => {
      const contest = contests.find((item) => item.slug === row.slug);
      if (!contest) problems.push(`${row.slug}: concurso não encontrado.`);
      const positions = row.positions ? parsePositionLines(row.positions.join("\n")) : null;
      if (positions && !positions.ok) problems.push(`${row.slug}: cargo inválido na linha ${positions.line}.`);
      if ((row.feeText?.length ?? 0) > 120 || (row.examLocations?.length ?? 0) > 300 || (row.authorization?.length ?? 0) > 300) {
        problems.push(`${row.slug}: texto longo demais.`);
      }
      return { row, contest, positions: positions?.ok ? positions.positions : null };
    });

    for (const { row, contest, positions } of plans) {
      console.log(`${contest ? "~" : "?"} ${row.slug}`);
      if (row.feeText !== undefined) console.log(`    taxa: ${contest?.feeText ?? "—"} → ${row.feeText}`);
      if (row.authorization !== undefined) console.log(`    autorização: ${contest?.authorization ?? "—"} → ${row.authorization}`);
      if (row.examLocations !== undefined) console.log(`    locais: ${contest?.examLocations ?? "—"} → ${row.examLocations}`);
      if (row.stages !== undefined) console.log(`    etapas: ${row.stages.join(" · ")}`);
      if (positions) {
        console.log(`    cargos (${contest?.contestPositions.length ?? 0} → ${positions.length}):`);
        for (const position of positions) {
          console.log(`      - ${position.name} · vagas ${position.vacancies ?? "—"}${position.hasReserveList ? " + CR" : ""} · salário ${position.salaryCents ?? "—"} · ${position.educationLevel ?? "—"}`);
        }
      }
    }

    if (problems.length > 0) {
      for (const problem of problems) console.log(`  ! ${problem}`);
      throw new Error("Corrija os problemas acima antes de gravar.");
    }

    if (!apply) {
      console.log("\nDry-run: nada foi gravado. Use --apply para gravar.");
      return;
    }

    // Reversal log first: previous values and positions of every contest touched.
    const logDir = resolve("data-private/logs");
    await mkdir(logDir, { recursive: true });
    const logFile = resolve(logDir, `contest-enrich-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await writeFile(
      logFile,
      JSON.stringify(
        plans.map(({ contest }) => ({
          id: contest!.id,
          slug: contest!.slug,
          feeText: contest!.feeText,
          stages: contest!.stages,
          examLocations: contest!.examLocations,
          authorization: contest!.authorization,
          positions: contest!.contestPositions,
        })),
        null,
        2,
      ),
    );

    await prisma.$transaction(async (transaction) => {
      for (const { row, contest, positions } of plans) {
        if (!contest) continue;
        await transaction.contest.update({
          where: { id: contest.id },
          data: {
            ...(row.feeText !== undefined ? { feeText: row.feeText || null } : {}),
            ...(row.stages !== undefined ? { stages: row.stages.join("\n").slice(0, 2000) } : {}),
            ...(row.examLocations !== undefined ? { examLocations: row.examLocations || null } : {}),
            ...(row.authorization !== undefined ? { authorization: row.authorization || null } : {}),
          },
        });
        if (positions) {
          await transaction.contestPosition.deleteMany({ where: { contestId: contest.id } });
          await transaction.contestPosition.createMany({
            data: positions.map((position, index) => ({ ...position, contestId: contest.id, sortOrder: index })),
          });
        }
      }
    });

    console.log(`\nGravado: ${plans.length} concursos. Log de reversão: ${logFile}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
