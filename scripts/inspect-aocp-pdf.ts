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
  answerFor,
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
      ["-xml", "-hidden", "-nodrm", "-enc", "UTF-8", resolve(prova), "document"],
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

    const describe = (question: { number: number; variant: number; section: string | null }) =>
      question.variant > 0 ? `${question.number} (${question.section})` : String(question.number);

    const missingAnswers = exam.questions
      .filter((question) => answerFor(answerKey, question) === null)
      .map(describe);

    const annulled = exam.questions
      .filter((question) => answerFor(answerKey, question) === "ANNULLED")
      .map(describe);

    const variants = exam.questions
      .filter((question) => question.variant > 0)
      .map(describe);

    const bySection: Record<string, number> = {};

    for (const question of exam.questions) {
      const name = `${question.block ? `${question.block} · ` : ""}${question.section ?? "(sem seção)"}`;
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
          answerKeyEntries: [...answerKey.values()].reduce((sum, list) => sum + list.length, 0),
          languageVariants: variants,
          annulled,
          missingAnswers,
          issues,
        },
        null,
        2,
      ),
    );

    const detail = Number(argumentValue("questao") ?? "1");
    const variant = Number(argumentValue("variante") ?? "1") - 1;
    const question = exam.questions.find(
      (item) => item.number === detail && item.variant === variant,
    );

    if (question) {
      console.log(`\n--- Questão ${question.number} (${question.block ?? "-"} · ${question.section}) · gabarito ${answerFor(answerKey, question) ?? "?"}`);
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
