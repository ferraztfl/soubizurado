import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { validateQuestionForPublication } from "../src/modules/question-bank/domain/question-publication-policy";
import { getPrismaClient } from "../src/shared/infrastructure/database/prisma";

/*
 * Bulk publication of in-review questions through the SAME publication
 * policy as the review screen (validateQuestionForPublication), plus the
 * checks of publishQuestionAction (defined answer key, active topic
 * inside the question discipline) and a completeness guard: a short
 * statement without support text or images is probably a lost context.
 * The answer key status is kept as is (bulk publishing is not a human
 * verification).
 *
 *   npm run questions:publish            # dry-run, prints the reasons
 *   npm run questions:publish -- --apply # writes, after a reversal log
 */

const MIN_STANDALONE_STATEMENT = 120;
const CHUNK = 500;

function plain(value: string): string {
  return value.replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing from the environment.");
  }

  const apply = process.argv.includes("--apply");
  const prisma = getPrismaClient();

  try {
    const questions = await prisma.question.findMany({
      where: { status: "IN_REVIEW" },
      select: {
        id: true,
        type: true,
        statement: true,
        answerKeyStatus: true,
        correctTrueFalse: true,
        sourceId: true,
        disciplineId: true,
        topicId: true,
        source: { select: { sourceType: true } },
        examination: { select: { boardId: true, year: true, title: true } },
        topic: { select: { disciplineId: true, isActive: true } },
        _count: { select: { mediaLinks: true, supportLinks: true } },
        alternatives: { select: { content: true, isCorrect: true, _count: { select: { mediaLinks: true } } } },
      },
    });

    const publishable: string[] = [];
    const reasons = new Map<string, number>();
    const count = (reason: string) => reasons.set(reason, (reasons.get(reason) ?? 0) + 1);

    for (const question of questions) {
      if (question.answerKeyStatus !== "DEFINED" && question.answerKeyStatus !== "VERIFIED") {
        count("gabarito não definido");
        continue;
      }

      if (question.topicId && (!question.topic?.isActive || question.topic.disciplineId !== question.disciplineId)) {
        count("subtópico inconsistente com a matéria");
        continue;
      }

      const issues = validateQuestionForPublication({
        type: question.type,
        statement: question.statement,
        sourceId: question.sourceId,
        sourceType: question.source?.sourceType ?? null,
        examination: question.examination ? { boardId: question.examination.boardId, year: question.examination.year } : null,
        disciplineId: question.disciplineId,
        topicId: question.topicId,
        correctTrueFalse: question.correctTrueFalse,
        alternatives: question.alternatives.map((alternative) => ({
          content: alternative.content,
          isCorrect: alternative.isCorrect,
          mediaCount: alternative._count.mediaLinks,
        })),
      });

      if (issues.length > 0) {
        count(`política: ${issues[0]}`);
        continue;
      }

      // ENEM always has A–E; fewer means lost alternatives and a suspect answer key.
      if (
        question.type === "MULTIPLE_CHOICE" &&
        question.examination?.title.startsWith("ENEM") &&
        question.alternatives.length < 5
      ) {
        count("ENEM com menos de 5 alternativas (gabarito suspeito)");
        continue;
      }

      if (
        plain(question.statement).length < MIN_STANDALONE_STATEMENT &&
        question._count.supportLinks === 0 &&
        question._count.mediaLinks === 0
      ) {
        count("enunciado possivelmente incompleto (curto, sem texto de apoio nem imagem)");
        continue;
      }

      publishable.push(question.id);
    }

    console.log(
      JSON.stringify(
        {
          mode: apply ? "apply" : "dry-run",
          inReview: questions.length,
          publishable: publishable.length,
          keptInReview: Object.fromEntries([...reasons.entries()].sort((left, right) => right[1] - left[1])),
        },
        null,
        2,
      ),
    );

    if (!apply || publishable.length === 0) {
      if (!apply) console.log("Dry-run only. Re-run with --apply to publish.");
      return;
    }

    const directory = resolve("data-private", "publications");
    await mkdir(directory, { recursive: true });
    const logPath = resolve(directory, `publish-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await writeFile(
      logPath,
      JSON.stringify({ undo: "UPDATE questions SET status='IN_REVIEW', published_at=NULL WHERE id IN (ids)", ids: publishable }, null, 2),
      "utf8",
    );
    console.log(`Reversal log: ${logPath}`);

    let published = 0;
    const now = new Date();

    for (let index = 0; index < publishable.length; index += CHUNK) {
      const result = await prisma.question.updateMany({
        where: { id: { in: publishable.slice(index, index + CHUNK) }, status: "IN_REVIEW" },
        data: { status: "PUBLISHED", publishedAt: now },
      });
      published += result.count;
    }

    console.log(`Published ${published} questions.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
