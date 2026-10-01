import "dotenv/config";

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { pairExamFiles } from "../src/modules/imports/application/batch/pair-exam-files";
import { analyzeOfficialExam } from "../src/modules/imports/infrastructure/official-exams/analyze-official-exam";
import { createUpload, saveAnalysis } from "../src/modules/imports/infrastructure/official-exams/official-exam-upload-store";

/*
 * Read-only trial run of a folder of official exams: pairs booklets with
 * answer keys the same way the batch import does, analyzes every pair and
 * writes a CSV report. Nothing is written to the database and the original
 * files are not moved (analysis workspaces go to data-private, git-ignored).
 *
 *   npm run import:analyze-folder -- <folder>
 */

type Row = Record<string, string | number>;

async function main(): Promise<void> {
  const folder = process.argv.slice(2).find((argument) => !argument.startsWith("--"));

  if (!folder) throw new Error("Informe a pasta.");

  const root = resolve(folder);
  const all = (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isFile()).map((entry) => entry.name);

  // Copies the browser made ("nome (1).pdf") that are byte-identical to another file are ignored.
  const isCopy = (name: string) => /\(\d+\)\.pdf$/i.test(name);
  const byHash = new Map<string, string[]>();
  const copies: string[] = [];

  for (const name of [...all].sort()) {
    const hash = createHash("sha256").update(await readFile(join(root, name))).digest("hex");

    byHash.set(hash, [...(byHash.get(hash) ?? []), name]);
  }

  for (const group of byHash.values()) {
    // Keep the file without the copy marker (or the first one when all have it).
    const keep = group.find((name) => !isCopy(name)) ?? group[0]!;

    copies.push(...group.filter((name) => name !== keep && isCopy(name)));
  }

  const files = all.filter((name) => !copies.includes(name));
  const pairing = pairExamFiles(files);

  if (copies.length > 0) console.log(`Cópias idênticas ignoradas: ${copies.join(", ")}`);
  const rows: Row[] = [];

  console.log(`${files.length} arquivos → ${pairing.pairs.length} pares, ${pairing.unpaired.length} sem par.`);

  for (const [index, pair] of pairing.pairs.entries()) {
    const row: Row = { prova: pair.booklet, gabarito: pair.answerKey, estado: "", leitor: "", questoes: 0, importaveis: 0, anuladas: 0, orgao: "", cargo: "", ano: "", banca: "", pendencias: "" };

    try {
      const uploadId = await createUpload({
        booklet: new Uint8Array(await readFile(join(root, pair.booklet))),
        answerKey: new Uint8Array(await readFile(join(root, pair.answerKey))),
      });
      const analysis = await analyzeOfficialExam(uploadId, { booklet: pair.booklet, answerKey: pair.answerKey });

      await saveAnalysis(analysis);

      const complete = Boolean(analysis.suggestedBoardSlug && analysis.detected.organization && analysis.detected.careerPosition && analysis.detected.year);

      row.estado = analysis.blockingIssues.length > 0 ? "BLOQUEADA" : complete ? "PRONTA" : "REVISAR";
      row.leitor = analysis.board ?? "";
      row.questoes = analysis.questions.length;
      row.importaveis = analysis.questions.filter((question) => !question.annulled && question.answer).length;
      row.anuladas = analysis.questions.filter((question) => question.annulled).length;
      row.orgao = analysis.detected.organization ?? "";
      row.cargo = analysis.detected.careerPosition ?? "";
      row.ano = analysis.detected.year ?? "";
      row.banca = analysis.suggestedBoardSlug ?? "";
      row.pendencias = analysis.blockingIssues.slice(0, 3).join(" | ");
      row.uploadId = uploadId;
    } catch (error) {
      row.estado = "FALHOU";
      row.pendencias = error instanceof Error ? error.message.slice(0, 200) : "erro";
    }

    rows.push(row);
    console.log(`[${index + 1}/${pairing.pairs.length}] ${row.estado} ${row.questoes}q — ${pair.booklet}`);
  }

  for (const item of pairing.unpaired) {
    rows.push({ prova: item.file, gabarito: "", estado: "SEM PAR", pendencias: item.reason });
  }

  const columns = ["estado", "prova", "gabarito", "leitor", "questoes", "importaveis", "anuladas", "orgao", "cargo", "ano", "banca", "pendencias", "uploadId"];
  const cell = (value: string | number | undefined) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = String.fromCharCode(0xfeff) + [columns.join(";"), ...rows.map((row) => columns.map((column) => cell(row[column])).join(";"))].join("\r\n");

  await mkdir("data-private/logs", { recursive: true });

  const out = `data-private/logs/analise-pasta-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;

  await writeFile(out, csv);

  const count = (state: string) => rows.filter((row) => row.estado === state).length;

  console.log(`\nPRONTA ${count("PRONTA")} · REVISAR ${count("REVISAR")} · BLOQUEADA ${count("BLOQUEADA")} · FALHOU ${count("FALHOU")} · SEM PAR ${count("SEM PAR")}`);
  console.log(`Relatório: ${out}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
