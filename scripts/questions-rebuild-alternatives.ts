import "dotenv/config";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import { z } from "zod";

import { getPrismaClient } from "../src/shared/infrastructure/database/prisma";

/*
 * Rebuilds the alternatives and the answer key of questions whose import
 * lost alternatives (e.g. ENEM "0" dropped by the old source), from a
 * reviewed corrections file written against the official booklet.
 *
 * Existing alternatives are matched by text and keep their ids (student
 * attempts point at them), only their letter / position / correctness
 * change; missing ones are created; nothing is deleted — an existing
 * alternative absent from the official list aborts that question. Every
 * change writes a question_revisions row (before / after), and the answer
 * key becomes VERIFIED. The question status is not touched.
 *
 *   npm run questions:rebuild-alternatives -- <corrections.json>          # dry-run
 *   npm run questions:rebuild-alternatives -- <corrections.json> --apply  # writes, after a reversal log
 */

const correctionsSchema = z.object({
  source: z.string().min(5),
  corrections: z
    .array(
      z.object({
        code: z.string().regex(/^Q\d{5,9}$/),
        officialNumber: z.number().int().positive(),
        reason: z.string().min(10).max(500),
        alternatives: z
          .array(
            z.object({
              label: z.string().regex(/^[A-E]$/),
              content: z.string().min(1).max(5000),
              /** Current (damaged) text of this alternative; its text becomes `content`. */
              replaces: z.string().min(1).optional(),
            }),
          )
          .min(2),
        correctLabel: z.string().regex(/^[A-E]$/),
      }),
    )
    .min(1),
});

type Snapshot = {
  statement: string;
  correctTrueFalse: boolean | null;
  answerKeyStatus: string;
  alternatives: { id: string; label: string; content: string; isCorrect: boolean }[];
};

const normalize = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.;]$/, "")
    .toLowerCase();

async function main(): Promise<void> {
  const file = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
  const apply = process.argv.includes("--apply");

  if (!file) {
    throw new Error("Usage: questions:rebuild-alternatives -- <corrections.json> [--apply]");
  }

  const input = correctionsSchema.parse(JSON.parse(await readFile(file, "utf8")));
  const prisma = getPrismaClient();
  const plans: {
    questionId: string;
    code: string;
    reason: string;
    before: Snapshot;
    after: Snapshot;
    updates: { id: string; label: string; position: number; isCorrect: boolean; content?: string }[];
    creates: { label: string; position: number; content: string; isCorrect: boolean }[];
  }[] = [];

  try {
    for (const correction of input.corrections) {
      const labels = correction.alternatives.map((item) => item.label);

      if (new Set(labels).size !== labels.length || !labels.includes(correction.correctLabel)) {
        console.log(`✗ ${correction.code}: letras repetidas ou gabarito fora da lista.`);
        continue;
      }

      const question = await prisma.question.findFirst({
        where: { publicNumber: Number(correction.code.slice(1)) },
        select: {
          id: true,
          type: true,
          statement: true,
          correctTrueFalse: true,
          answerKeyStatus: true,
          alternatives: { orderBy: { position: "asc" }, select: { id: true, label: true, content: true, isCorrect: true } },
        },
      });

      if (!question || question.type !== "MULTIPLE_CHOICE") {
        console.log(`✗ ${correction.code}: questão não encontrada ou não é de múltipla escolha.`);
        continue;
      }

      const unused = new Map(question.alternatives.map((item) => [item.id, item]));
      const updates: (typeof plans)[number]["updates"] = [];
      const creates: (typeof plans)[number]["creates"] = [];
      const afterAlternatives: Snapshot["alternatives"] = [];

      correction.alternatives.forEach((official, position) => {
        const wanted = normalize(official.replaces ?? official.content);
        const match = [...unused.values()].find((item) => normalize(item.content) === wanted);
        const isCorrect = official.label === correction.correctLabel;

        if (match) {
          unused.delete(match.id);
          const content = official.replaces ? official.content : undefined;
          updates.push({ id: match.id, label: official.label, position, isCorrect, ...(content ? { content } : {}) });
          afterAlternatives.push({ id: match.id, label: official.label, content: content ?? match.content, isCorrect });
        } else {
          creates.push({ label: official.label, position, content: official.content, isCorrect });
          afterAlternatives.push({ id: "(nova)", label: official.label, content: official.content, isCorrect });
        }
      });

      if (unused.size > 0) {
        const leftovers = [...unused.values()].map((item) => `${item.label}) ${item.content}`).join("; ");
        console.log(`✗ ${correction.code}: alternativas atuais que não estão na lista oficial (${leftovers}). Nada será feito.`);
        continue;
      }

      const before: Snapshot = {
        statement: question.statement,
        correctTrueFalse: question.correctTrueFalse,
        answerKeyStatus: question.answerKeyStatus,
        alternatives: question.alternatives,
      };
      const after: Snapshot = { ...before, answerKeyStatus: "VERIFIED", alternatives: afterAlternatives };

      plans.push({ questionId: question.id, code: correction.code, reason: correction.reason, before, after, updates, creates });

      const show = (alternatives: Snapshot["alternatives"]) =>
        alternatives.map((item) => `${item.label}${item.isCorrect ? "*" : ""}) ${item.content}`).join("  ");
      console.log(`\n${correction.code} (questão oficial ${correction.officialNumber})`);
      console.log(`  antes:  ${show(before.alternatives)}`);
      console.log(`  depois: ${show(after.alternatives)}`);
    }

    if (!apply || plans.length === 0) {
      if (!apply) console.log("\nDry-run only. Re-run with --apply to write.");
      return;
    }

    const directory = resolve("data-private", "revisions");
    await mkdir(directory, { recursive: true });
    const logPath = resolve(
      directory,
      `rebuild-alternatives-${basename(file, ".json")}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    );
    await writeFile(
      logPath,
      JSON.stringify(
        {
          source: input.source,
          undo: "Per question: delete the created alternatives, restore labels/positions/isCorrect and answer_key_status from `before`.",
          plans,
        },
        null,
        2,
      ),
      "utf8",
    );
    console.log(`\nReversal log: ${logPath}`);

    for (const plan of plans) {
      await prisma.$transaction(async (transaction) => {
        // Park current rows away from the final letters / positions (both are unique per question).
        for (const [index, update] of plan.updates.entries()) {
          await transaction.questionAlternative.update({
            where: { id: update.id },
            data: { label: `~${index}`, position: 1000 + index },
          });
        }

        for (const update of plan.updates) {
          await transaction.questionAlternative.update({
            where: { id: update.id },
            data: {
              label: update.label,
              position: update.position,
              isCorrect: update.isCorrect,
              ...(update.content ? { content: update.content } : {}),
            },
          });
        }

        for (const create of plan.creates) {
          await transaction.questionAlternative.create({ data: { questionId: plan.questionId, ...create } });
        }

        await transaction.question.update({
          where: { id: plan.questionId },
          data: { answerKeyStatus: "VERIFIED" },
        });

        const question = await transaction.question.findUniqueOrThrow({
          where: { id: plan.questionId },
          select: { status: true, alternatives: { orderBy: { position: "asc" }, select: { id: true, label: true, content: true, isCorrect: true } } },
        });

        await transaction.questionRevision.create({
          data: {
            questionId: plan.questionId,
            editorProfileId: null,
            reason: plan.reason,
            changedFields: ["alternatives", "answerKey"],
            // A content fix of a matched alternative is part of "alternatives".
            answerKeyChanged: true,
            questionStatus: question.status,
            before: plan.before,
            after: { ...plan.after, alternatives: question.alternatives },
          },
        });
      });

      console.log(`✓ ${plan.code} reconstruída.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
