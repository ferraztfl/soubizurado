import "dotenv/config";

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { normalizeQuestionText } from "../src/modules/imports/domain/question-fingerprint";
import { getPrismaClient } from "../src/shared/infrastructure/database/prisma";

/*
 * Replaces a context restored as an image ("![…](media:<asset>)", see
 * questions-attach-context) by reviewed plain text — for wide, text-only
 * contexts that are unreadable as a page crop on small screens. Removes
 * the question's link to those images (the assets themselves stay).
 *
 *   npm run questions:context-to-text -- <code→text.json>          # dry-run
 *   npm run questions:context-to-text -- <code→text.json> --apply  # writes, after a reversal log
 */

const MEDIA_REF = /\(media:([0-9a-f-]{36})\)/g;
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

async function main(): Promise<void> {
  const file = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
  const apply = process.argv.includes("--apply");

  if (!file) {
    throw new Error("Usage: questions:context-to-text -- <code→text.json> [--apply]");
  }

  const texts: Record<string, string> = JSON.parse(await readFile(file, "utf8"));
  const prisma = getPrismaClient();
  const log: unknown[] = [];

  try {
    for (const [code, text] of Object.entries(texts)) {
      const question = await prisma.question.findFirst({
        where: { publicNumber: Number(code.slice(1)) },
        select: {
          id: true,
          status: true,
          statement: true,
          supportLinks: { select: { supportContentId: true, position: true, supportContent: { select: { content: true } } } },
          mediaLinks: { select: { id: true, mediaAssetId: true, role: true, position: true } },
        },
      });
      const imageSupport = question?.supportLinks.find((link) => MEDIA_REF.test(link.supportContent.content));
      MEDIA_REF.lastIndex = 0;

      if (!question || !imageSupport || text.trim().length < 20) {
        console.log(`✗ ${code}: sem contexto em imagem para trocar (ou texto vazio).`);
        continue;
      }

      const assetIds = [...imageSupport.supportContent.content.matchAll(MEDIA_REF)].map((match) => match[1]!);
      const links = question.mediaLinks.filter((link) => assetIds.includes(link.mediaAssetId));
      console.log(`✓ ${code}: imagem → texto (${text.length} caracteres); remove ${links.length} ligação(ões) de imagem.`);

      if (!apply) continue;

      const content = text.trim();
      await prisma.$transaction(async (transaction) => {
        const support = await transaction.questionSupportContent.upsert({
          where: { contentHash: sha256(normalizeQuestionText(content)) },
          update: {},
          create: { content, contentHash: sha256(normalizeQuestionText(content)) },
          select: { id: true },
        });
        await transaction.questionSupportLink.delete({
          where: { questionId_supportContentId: { questionId: question.id, supportContentId: imageSupport.supportContentId } },
        });
        await transaction.questionSupportLink.create({
          data: { questionId: question.id, supportContentId: support.id, position: imageSupport.position },
        });
        await transaction.questionMediaLink.deleteMany({ where: { id: { in: links.map((link) => link.id) } } });
        await transaction.questionRevision.create({
          data: {
            questionId: question.id,
            editorProfileId: null,
            reason: "Contexto da prova oficial convertido de imagem para texto (legibilidade em telas pequenas).",
            changedFields: ["supportContent", "media"],
            answerKeyChanged: false,
            questionStatus: question.status,
            before: { supportContents: [imageSupport.supportContent.content], media: assetIds },
            after: { supportContents: [content], media: [] },
          },
        });
      });
      log.push({ code, questionId: question.id, previousSupportContentId: imageSupport.supportContentId, removedMediaLinks: links });
    }

    if (!apply) {
      console.log("Dry-run only. Re-run with --apply to write.");
      return;
    }

    const directory = resolve("data-private", "revisions");
    await mkdir(directory, { recursive: true });
    const logPath = resolve(directory, `context-to-text-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await writeFile(logPath, JSON.stringify({ undo: "Re-link previousSupportContentId and re-create removedMediaLinks.", entries: log }, null, 2), "utf8");
    console.log(`Reversal log: ${logPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
