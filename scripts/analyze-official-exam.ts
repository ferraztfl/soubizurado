import "dotenv/config";

import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import { OFFICIAL_EXAM_BOARDS } from "../src/modules/imports/application/official-exams/official-exam";
import { analyzeOfficialExam } from "../src/modules/imports/infrastructure/official-exams/analyze-official-exam";
import {
  createUpload,
  saveAnalysis,
} from "../src/modules/imports/infrastructure/official-exams/official-exam-upload-store";

/*
 * Same as the "Nova importação" screen, from the command line: stores the
 * PDFs, analyzes them and prints the preview URL. Nothing is written to
 * the database; confirm the import in the backoffice preview.
 *
 *   npm run import:official-exam -- --prova=<pdf> --gabarito=<pdf>
 */

function argumentValue(name: string): string | undefined {
  const prefix = `--${name}=`;

  return process.argv
    .slice(2)
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);
}

async function main(): Promise<void> {
  const prova = argumentValue("prova");
  const gabarito = argumentValue("gabarito");

  if (!prova || !gabarito) {
    throw new Error("Use --prova=<pdf> --gabarito=<pdf>.");
  }

  const uploadId = await createUpload({
    booklet: new Uint8Array(await readFile(resolve(prova))),
    answerKey: new Uint8Array(await readFile(resolve(gabarito))),
  });

  const analysis = await analyzeOfficialExam(uploadId, {
    booklet: basename(prova),
    answerKey: basename(gabarito),
  });

  await saveAnalysis(analysis);

  console.log(
    JSON.stringify(
      {
        uploadId,
        board: analysis.board ? OFFICIAL_EXAM_BOARDS[analysis.board] : null,
        detected: analysis.detected,
        questions: analysis.questions.length,
        annulled: analysis.questions.filter((question) => question.annulled).map((question) => question.key),
        blockingIssues: analysis.blockingIssues,
        preview: `/admin/importacoes/nova/${uploadId}`,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
