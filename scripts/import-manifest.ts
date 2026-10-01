import "dotenv/config";

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { resolveExamSection } from "../src/modules/imports/application/official-exams/resolve-exam-section";
import { confirmOfficialExamImport } from "../src/modules/imports/infrastructure/official-exams/confirm-official-exam-import";
import { loadAnalysis, saveAnalysis } from "../src/modules/imports/infrastructure/official-exams/official-exam-upload-store";
import { loadSectionTaxonomyEntries } from "../src/modules/imports/infrastructure/official-exams/run-official-exam-import";

/*
 * Imports a set of already analyzed official exams from a manifest written by
 * the administrator (organization, position, year and what the sections of
 * each booklet map to). Same rules as the "Nova importação" screen; questions
 * enter IN_REVIEW. Dry-run by default; --apply writes, one exam at a time
 * (idempotent: re-running skips what was already imported).
 *
 *   npm run import:manifest -- <manifesto.json> [--apply] [--only=<texto do nome da prova>]
 *
 * Manifest: an array of
 *   { "prova": "<booklet file name>", "org": "...", "cargo": "...", "year": 2019,
 *     "level": "Superior", "sections": { "<section>": "discipline:<Matéria>" | "area:<slug>" },
 *     "ranges": "1-5:Língua Portuguesa;6-10:Raciocínio Lógico", "skip": [14, 16] }
 * - "ranges" rewrites the section of the questions by number (when the booklet
 *   headings could not be read); "skip" leaves out questions the reader could
 *   not get right (e.g. alternatives that are formulas), they are listed.
 */

type Entry = Readonly<{
  prova: string;
  org: string;
  cargo: string;
  year: number;
  level?: string;
  sections?: Readonly<Record<string, string>>;
  ranges?: string;
  skip?: readonly number[];
}>;

const ANALYSES_ROOT = resolve("data-private/imports/official-exams");

async function findUploadId(prova: string): Promise<string | null> {
  let best: { id: string; createdAt: string } | null = null;

  for (const id of await readdir(ANALYSES_ROOT)) {
    try {
      const analysis = JSON.parse(await readFile(join(ANALYSES_ROOT, id, "analysis.json"), "utf8")) as { bookletFileName: string; createdAt: string };

      if (analysis.bookletFileName === prova && (!best || analysis.createdAt > best.createdAt)) {
        best = { id, createdAt: analysis.createdAt };
      }
    } catch {
      // Not an analysis folder.
    }
  }

  return best?.id ?? null;
}

function parseRanges(text: string): { from: number; to: number; name: string }[] {
  return text
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = /^(\d+)-(\d+):(.+)$/.exec(part);

      if (!match) throw new Error(`Faixa inválida: "${part}"`);

      return { from: Number(match[1]), to: Number(match[2]), name: match[3]!.trim() };
    });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const file = args.find((argument) => !argument.startsWith("--"));
  const apply = args.includes("--apply");
  const only = args.find((argument) => argument.startsWith("--only="))?.slice("--only=".length);

  if (!file) throw new Error("Informe o manifesto.");

  const entries = (JSON.parse(await readFile(resolve(file), "utf8")) as Entry[]).filter((entry) => !only || entry.prova.includes(only));
  const summary: Record<string, unknown>[] = [];
  const taxonomyEntries = await loadSectionTaxonomyEntries();

  for (const entry of entries) {
    const label = entry.prova.replace(/^instituto-aocp-/, "").replace(/-prova\.pdf$/, "");
    const uploadId = await findUploadId(entry.prova);

    if (!uploadId) {
      console.log(`✗ ${label}: análise não encontrada (rode import:analyze-folder).`);
      summary.push({ prova: entry.prova, erro: "análise não encontrada" });
      continue;
    }

    const analysis = await loadAnalysis(uploadId);

    if (!analysis) {
      console.log(`✗ ${label}: análise ilegível.`);
      continue;
    }

    const skip = new Set(entry.skip ?? []);
    const ranges = entry.ranges ? parseRanges(entry.ranges) : null;
    const questions = analysis.questions
      .filter((question) => !skip.has(question.number))
      .map((question) => (ranges ? { ...question, section: ranges.find((range) => question.number >= range.from && question.number <= range.to)?.name ?? question.section } : question));
    const issues: string[] = analysis.blockingIssues.filter((issue) => ![...skip].some((number) => new RegExp(`^(Questão|Item) ${number}(-v\\d+)?[: ]`).test(issue)));

    // Sections the automatic mapping cannot resolve need a choice in the manifest.
    for (const section of new Set(questions.map((question) => question.section ?? ""))) {
      if (!entry.sections?.[section] && resolveExamSection(section || null, taxonomyEntries).kind === "UNRESOLVED") {
        issues.push(`Seção sem matéria: "${section}" (use "sections" no manifesto).`);
      }
    }

    if (issues.length > 0) {
      console.log(`✗ ${label}: pendências restantes: ${issues.slice(0, 2).join(" | ")}`);
      summary.push({ prova: entry.prova, erro: issues.slice(0, 3) });
      continue;
    }

    console.log(`${apply ? "→" : "·"} ${label}: ${questions.length} questões${skip.size > 0 ? ` (fora: ${[...skip].join(", ")})` : ""} · ${entry.org} · ${entry.cargo} · ${entry.year}`);

    if (!apply) {
      summary.push({ prova: entry.prova, questoes: questions.length });
      continue;
    }

    // The edited analysis replaces the stored one (the original file stays in the PDFs).
    await saveAnalysis({ ...analysis, questions, blockingIssues: [] });

    try {
      const result = await confirmOfficialExamImport({
        uploadId,
        boardSlug: analysis.suggestedBoardSlug ?? "instituto-aocp",
        organization: entry.org,
        careerPosition: entry.cargo,
        year: entry.year,
        level: entry.level ?? analysis.detected.level ?? undefined,
        notice: analysis.detected.notice ?? undefined,
        sectionChoices: entry.sections ?? {},
      });

      console.log(`   importadas ${result.counts.imported} · duplicadas ${result.counts.duplicates} · em revisão ${result.counts.reviewRequired} · falhas ${result.counts.failed}`);
      summary.push({ prova: entry.prova, uploadId, ...result.counts, anuladas: result.skippedAnnulled });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 200) : "erro";

      console.log(`   ✗ ${message}`);
      summary.push({ prova: entry.prova, uploadId, erro: message });
    }
  }

  if (apply) {
    await mkdir("data-private/logs", { recursive: true });
    await writeFile(`data-private/logs/import-manifest-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, JSON.stringify(summary, null, 2));
  } else {
    console.log("\nDry-run. Use --apply para importar (as questões entram em revisão).");
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
