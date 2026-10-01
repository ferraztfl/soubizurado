import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";

import { confirmOfficialExamImport } from "../src/modules/imports/infrastructure/official-exams/confirm-official-exam-import";
import { loadAnalysis } from "../src/modules/imports/infrastructure/official-exams/official-exam-upload-store";

/*
 * Confirms an analyzed official exam (same rules as the "Nova importação"
 * preview and the batch import) with the organization and position names
 * chosen by the administrator. Questions enter IN_REVIEW, never published.
 * Dry-run by default; --apply writes and saves the result in data-private/logs.
 *
 *   npm run import:confirm-analysis -- --upload=<id> --org="UFOB – ..." --cargo="Economista" [--year=2018]
 *     [--section="Conhecimentos Específicos=discipline:Economia" ...] [--apply]
 *
 * --section fixes a booklet section the automatic mapping cannot resolve:
 * "discipline:<Matéria>" or "area:<slug da área do conhecimento>".
 */

function argumentValue(name: string): string | undefined {
  const prefix = `--${name}=`;

  return process.argv
    .slice(2)
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);
}

async function main(): Promise<void> {
  const uploadId = argumentValue("upload");
  const apply = process.argv.slice(2).includes("--apply");

  if (!uploadId) throw new Error("Use --upload=<id>.");

  const analysis = await loadAnalysis(uploadId);

  if (!analysis) throw new Error("Análise não encontrada.");

  const sectionChoices = Object.fromEntries(
    process.argv
      .slice(2)
      .filter((argument) => argument.startsWith("--section="))
      .map((argument) => argument.slice("--section=".length))
      .map((pair) => [pair.slice(0, pair.indexOf("=")), pair.slice(pair.indexOf("=") + 1)]),
  );
  const input = {
    sectionChoices,
    uploadId,
    boardSlug: analysis.suggestedBoardSlug ?? "",
    organization: argumentValue("org") ?? analysis.detected.organization,
    careerPosition: argumentValue("cargo") ?? analysis.detected.careerPosition,
    year: argumentValue("year") ?? analysis.detected.year,
    level: analysis.detected.level ?? undefined,
    notice: analysis.detected.notice ?? undefined,
  };

  console.log(
    JSON.stringify(
      {
        ...input,
        questions: analysis.questions.length,
        annulled: analysis.questions.filter((question) => question.annulled).length,
        sections: analysis.sections,
        blockingIssues: analysis.blockingIssues,
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log("Dry-run. Use --apply para importar (as questões entram em revisão).");
    return;
  }

  const result = await confirmOfficialExamImport(input);

  await mkdir("data-private/logs", { recursive: true });
  await writeFile(`data-private/logs/import-official-${uploadId}.json`, JSON.stringify({ input, result }, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
