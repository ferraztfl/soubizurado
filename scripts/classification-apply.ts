import "dotenv/config";

import {
  mkdir,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";

import { applyClassificationSuggestion } from "../src/modules/classification/infrastructure/apply-classification-suggestion";
import {
  createQuestionClassifier,
  readMinimumConfidence,
} from "../src/modules/classification/infrastructure/create-question-classifier";
import { getPrismaClient } from "../src/shared/infrastructure/database/prisma";

/*
 * Bulk-applies high-confidence classification suggestions.
 *
 * Only COMPLETED suggestions of one classifier version, with confidence
 * >= the threshold, on questions still IN_REVIEW and WITHOUT a topic
 * (manual classifications are never overwritten). Each question goes
 * through the same validation as the review screen. Nothing is
 * published. --apply first writes a reversal log to data-private.
 *
 *   npm run classification:apply                       # dry-run
 *   npm run classification:apply -- --apply
 *   npm run classification:apply -- --apply --min-confidence=0.9
 *   npm run classification:apply -- --classifier-version=rule-based-v1
 */

const REVERSAL_LOG_DIRECTORY = resolve("data-private", "classification-applies");

function argumentValue(name: string): string | undefined {
  const prefix = `--${name}=`;

  return process.argv
    .slice(2)
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length)
    .trim();
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing from the environment.");
  }

  const apply = process.argv.slice(2).includes("--apply");
  const classifierVersion =
    argumentValue("classifier-version") ?? createQuestionClassifier().version;
  const minimumConfidence = argumentValue("min-confidence")
    ? Number(argumentValue("min-confidence"))
    : readMinimumConfidence();

  if (!Number.isFinite(minimumConfidence) || minimumConfidence < 0 || minimumConfidence > 1) {
    throw new Error("--min-confidence must be between 0 and 1.");
  }

  const prisma = getPrismaClient();

  try {
    const tasks = await prisma.questionClassificationTask.findMany({
      where: {
        classifierVersion,
        status: "COMPLETED",
        appliedAt: null,
        suggestedTopicId: { not: null },
        confidence: { gte: minimumConfidence },
        question: {
          status: "IN_REVIEW",
          topicId: null,
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: {
        id: true,
        questionId: true,
        confidence: true,
        suggestedDiscipline: { select: { name: true } },
        question: { select: { disciplineId: true } },
        suggestedDisciplineId: true,
      },
    });

    // One suggestion per question: the most recent.
    const latestByQuestion = new Map<string, (typeof tasks)[number]>();

    for (const task of tasks) {
      if (!latestByQuestion.has(task.questionId)) {
        latestByQuestion.set(task.questionId, task);
      }
    }

    const selected = [...latestByQuestion.values()];

    const byDiscipline: Record<string, number> = {};

    for (const task of selected) {
      const name = task.suggestedDiscipline?.name ?? "?";
      byDiscipline[name] = (byDiscipline[name] ?? 0) + 1;
    }

    console.log(
      JSON.stringify(
        {
          mode: apply ? "apply" : "dry-run",
          classifierVersion,
          minimumConfidence,
          questionsToClassify: selected.length,
          changingDiscipline: selected.filter(
            (task) => task.suggestedDisciplineId !== task.question.disciplineId,
          ).length,
          byDiscipline,
        },
        null,
        2,
      ),
    );

    if (selected.length === 0) {
      console.log("Nothing to apply.");
      return;
    }

    if (!apply) {
      console.log("Dry-run only. Re-run with --apply to write.");
      return;
    }

    await mkdir(REVERSAL_LOG_DIRECTORY, { recursive: true });

    const logPath = resolve(
      REVERSAL_LOG_DIRECTORY,
      `apply-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    );

    const changes: unknown[] = [];
    const tally: Record<string, number> = {};

    // Written up front and rewritten at the end, so an interrupted run
    // still leaves a record of what was about to change.
    await writeFile(
      logPath,
      JSON.stringify({ classifierVersion, minimumConfidence, status: "started", changes }, null, 2),
      "utf8",
    );

    console.log(`Reversal log: ${logPath}`);

    for (const [index, task] of selected.entries()) {
      const result = await applyClassificationSuggestion(prisma, {
        taskId: task.id,
        questionId: task.questionId,
        appliedByProfileId: null,
        onlyIfUnclassified: true,
      });

      tally[result.status] = (tally[result.status] ?? 0) + 1;

      if (result.status === "APPLIED") {
        changes.push({
          questionId: task.questionId,
          taskId: task.id,
          previous: result.previous,
          next: result.next,
        });
      }

      if ((index + 1) % 100 === 0) {
        console.log(`${index + 1}/${selected.length}`, JSON.stringify(tally));
        await writeFile(
          logPath,
          JSON.stringify({ classifierVersion, minimumConfidence, status: "running", changes }, null, 2),
          "utf8",
        );
      }
    }

    await writeFile(
      logPath,
      JSON.stringify(
        { classifierVersion, minimumConfidence, status: "finished", tally, changes },
        null,
        2,
      ),
      "utf8",
    );

    console.log(JSON.stringify({ result: tally }, null, 2));
    console.log("CLASSIFICATION APPLY FINISHED");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
