import { execFile } from "node:child_process";
import {
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  join,
  resolve,
} from "node:path";
import { promisify } from "node:util";

import {
  parseAocpAnswerKey,
  parseAocpExam,
  readAocpLines,
  validateAocpExam,
} from "../src/modules/imports/infrastructure/providers/aocp-pdf-parser";

/*
 * Read-only inspection of an Instituto AOCP exam PDF + answer key.
 * Nothing is written to the database.
 *
 *   npm run inspect:aocp-pdf -- --prova=<pdf> --gabarito=<pdf> [--questao=58]
 */

const execFileAsync = promisify(execFile);

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

  const workspace = await mkdtemp(join(tmpdir(), "aocp-"));

  try {
    await execFileAsync(
      "pdftohtml",
      ["-xml", "-hidden", "-nodrm", "-i", "-enc", "UTF-8", resolve(prova), "document"],
      { cwd: workspace, windowsHide: true, maxBuffer: 1024 * 1024 * 16 },
    );

    const xml = await readFile(join(workspace, "document.xml"), "utf8");
    const { stdout: answerText } = await execFileAsync(
      "pdftotext",
      ["-enc", "UTF-8", resolve(gabarito), "-"],
      { windowsHide: true, maxBuffer: 1024 * 1024 * 4 },
    );

    const exam = parseAocpExam(readAocpLines(xml));
    const answerKey = parseAocpAnswerKey(answerText);
    const issues = validateAocpExam(exam);

    const missingAnswers = exam.questions
      .filter((question) => !answerKey.has(question.number))
      .map((question) => question.number);

    const annulled = [...answerKey.entries()]
      .filter(([, answer]) => answer === "ANNULLED")
      .map(([number]) => number);

    const bySection: Record<string, number> = {};

    for (const question of exam.questions) {
      const name = question.section ?? "(sem seção)";
      bySection[name] = (bySection[name] ?? 0) + 1;
    }

    console.log(
      JSON.stringify(
        {
          questions: exam.questions.length,
          sections: bySection,
          withSupportText: exam.questions.filter((question) => question.supportText).length,
          refersToHighlight: exam.questions
            .filter((question) => question.refersToHighlight)
            .map((question) => question.number),
          answerKeyEntries: answerKey.size,
          annulled,
          missingAnswers,
          issues,
        },
        null,
        2,
      ),
    );

    const detail = Number(argumentValue("questao") ?? "1");
    const question = exam.questions.find((item) => item.number === detail);

    if (question) {
      console.log(`\n--- Questão ${question.number} (${question.section}) · gabarito ${answerKey.get(question.number) ?? "?"}`);
      console.log(`[apoio] ${question.supportText ? question.supportText.slice(0, 300) + "…" : "—"}`);
      console.log(`[enunciado] ${question.statement}`);

      for (const alternative of question.alternatives) {
        console.log(`(${alternative.label}) ${alternative.content}`);
      }
    }
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
