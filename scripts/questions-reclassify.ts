import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { parseQuestionCode } from "../src/modules/question-bank/domain/question-code";
import { getPrismaClient } from "../src/shared/infrastructure/database/prisma";

/*
 * Manual reclassification decided by a reviewer (not an AI suggestion),
 * also for published questions: only catalog items, resolved by name
 * (Matéria / Tópico / Subtópico); the status is kept. Writes a
 * question_revisions entry and a reversal log.
 *
 *   npm run questions:reclassify -- "Q103446=Medicina Legal/Tanatologia Forense/Morte e Fenômenos Cadavéricos"
 *   npm run questions:reclassify -- "Q…=…" --apply
 */

type Entry = Readonly<{ code: string; path: readonly string[] }>;

function readEntries(): Entry[] {
  return process.argv
    .slice(2)
    .filter((argument) => !argument.startsWith("--"))
    .map((argument) => {
      const [code, path] = argument.split("=");
      const parts = (path ?? "").split("/").map((part) => part.trim());

      if (!code || parts.length !== 3 || parts.some((part) => !part)) {
        throw new Error(`Use "Q123=Matéria/Tópico/Subtópico": ${argument}`);
      }

      return { code: code.trim(), path: parts };
    });
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const entries = readEntries();
  const prisma = getPrismaClient();
  const log: unknown[] = [];

  try {
    for (const { code, path } of entries) {
      const publicNumber = parseQuestionCode(code);
      const question = publicNumber
        ? await prisma.question.findUnique({
            where: { publicNumber },
            select: { id: true, status: true, knowledgeAreaId: true, disciplineId: true, areaId: true, topicId: true, subtopicId: true },
          })
        : null;

      const topic = await prisma.topic.findFirst({
        where: {
          isActive: true,
          name: path[2],
          discipline: { isActive: true, name: path[0], knowledgeAreaId: { not: null } },
          area: { isActive: true, name: path[1] },
        },
        select: { id: true, areaId: true, disciplineId: true, discipline: { select: { knowledgeAreaId: true } } },
      });

      if (!question || question.status === "ARCHIVED" || !topic) {
        console.log(`✗ ${code}: ${!question ? "questão não encontrada" : !topic ? `"${path.join(" / ")}" não existe no catálogo` : "arquivada"}.`);
        continue;
      }

      const before = {
        knowledgeAreaId: question.knowledgeAreaId,
        disciplineId: question.disciplineId,
        areaId: question.areaId,
        topicId: question.topicId,
        subtopicId: question.subtopicId,
      };
      const after = {
        knowledgeAreaId: topic.discipline.knowledgeAreaId,
        disciplineId: topic.disciplineId,
        areaId: topic.areaId,
        topicId: topic.id,
        subtopicId: null,
      };

      console.log(`✓ ${code} (${question.status}) → ${path.join(" › ")}`);
      log.push({ code, questionId: question.id, before });

      if (!apply) continue;

      await prisma.$transaction([
        prisma.question.update({ where: { id: question.id }, data: after }),
        prisma.questionRevision.create({
          data: {
            questionId: question.id,
            editorProfileId: null,
            reason: `Reclassificação manual revisada: ${path.join(" › ")}.`,
            changedFields: ["taxonomy"],
            answerKeyChanged: false,
            questionStatus: question.status,
            before,
            after,
          },
        }),
      ]);
    }

    if (!apply) {
      console.log("Dry-run only. Re-run with --apply to write.");
      return;
    }

    const directory = resolve("data-private", "revisions");
    await mkdir(directory, { recursive: true });
    const logPath = resolve(directory, `reclassify-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await writeFile(logPath, JSON.stringify({ undo: "Restore the `before` taxonomy fields.", entries: log }, null, 2), "utf8");
    console.log(`Reversal log: ${logPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
