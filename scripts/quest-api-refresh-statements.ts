import "dotenv/config";

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { normalizeQuestionText, questionHtmlToDisplayText } from "../src/modules/imports/domain/question-fingerprint";
import { getPrismaClient } from "../src/shared/infrastructure/database/prisma";

/*
 * Quest API statements imported before paragraphs and tables were kept
 * were flattened into one line. Rebuilds them from the cached API
 * responses (no credits): only the layout changes — the words must stay
 * the same, otherwise the question is skipped.
 *
 *   npm run quest:refresh-statements            # dry-run
 *   npm run quest:refresh-statements -- --apply # writes, after a reversal log
 */

const CACHE = resolve("data-private", "imports", "quest-api", "cache");

/** Same words, ignoring table separators and spacing. */
const words = (value: string) => normalizeQuestionText(value.replace(/\|/g, " "));

async function loadCachedStatements(): Promise<Map<string, string>> {
  const statements = new Map<string, string>();
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const record = node as Record<string, unknown>;
    if (typeof record.id === "string" && typeof record.enunciado === "string") {
      statements.set(record.id, record.enunciado);
    }
    Object.values(record).forEach(walk);
  };

  for (const file of await readdir(CACHE)) {
    walk(JSON.parse(await readFile(resolve(CACHE, file), "utf8")));
  }

  return statements;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const cached = await loadCachedStatements();
  const prisma = getPrismaClient();
  const log: unknown[] = [];
  let skipped = 0;

  try {
    const occurrences = await prisma.questionOccurrence.findMany({
      where: { examination: { slug: { startsWith: "quest-api-" } } },
      select: { externalId: true, question: { select: { id: true, publicNumber: true, status: true, statement: true } } },
    });

    for (const { externalId, question } of occurrences) {
      const html = cached.get(externalId);
      if (!html) continue;

      const statement = questionHtmlToDisplayText(html);
      if (statement === question.statement) continue;

      if (words(statement) !== words(question.statement)) {
        skipped += 1;
        console.log(`✗ Q${question.publicNumber}: o texto mudou além da formatação (editado?); mantido.`);
        continue;
      }

      console.log(`✓ Q${question.publicNumber}: ${statement.split("\n").length} linhas.`);
      log.push({ questionId: question.id, publicNumber: question.publicNumber, previousStatement: question.statement });

      if (!apply) continue;

      await prisma.$transaction([
        prisma.question.update({ where: { id: question.id }, data: { statement } }),
        prisma.questionRevision.create({
          data: {
            questionId: question.id,
            editorProfileId: null,
            reason: "Enunciado da Quest API reformatado a partir da resposta original (parágrafos e tabelas preservados).",
            changedFields: ["statement"],
            answerKeyChanged: false,
            questionStatus: question.status,
            before: { statement: question.statement },
            after: { statement },
          },
        }),
      ]);
    }

    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", reformatted: log.length, skipped }));

    if (!apply) {
      console.log("Dry-run only. Re-run with --apply to write.");
      return;
    }

    const directory = resolve("data-private", "revisions");
    await mkdir(directory, { recursive: true });
    const logPath = resolve(directory, `quest-refresh-statements-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await writeFile(logPath, JSON.stringify({ undo: "Restore previousStatement.", entries: log }, null, 2), "utf8");
    console.log(`Reversal log: ${logPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
