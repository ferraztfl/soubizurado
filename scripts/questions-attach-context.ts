import "dotenv/config";

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import { normalizeQuestionText } from "../src/modules/imports/domain/question-fingerprint";
import { mediaStorageKey } from "../src/modules/imports/application/services/process-media-queue";
import { getPrismaClient } from "../src/shared/infrastructure/database/prisma";
import { createSupabaseMediaStorage, mediaStorageDriver } from "../src/shared/infrastructure/media-storage/stored-media";

/*
 * Restores the lost context of legacy ENEM questions from the official INEP
 * booklet: each reviewed crop (scripts/enem-context-extract.ts) is uploaded
 * like imported media, linked to the question, and a support text
 * "![Texto da prova oficial](media:<asset>)" places it before the command.
 * The OCR-free text of the context is kept as the image's alt text.
 *
 * Only questions still without support text or media are touched; each
 * gets a question_revisions row. The question status is not changed.
 *
 *   npm run questions:attach-context                 # dry-run
 *   npm run questions:attach-context -- --apply      # writes, after a reversal log
 *   npm run questions:attach-context -- --only=Q100700,Q100584
 */

type Context = {
  id: string;
  code: string;
  year: number;
  number: number;
  pdf?: string;
  crops?: string[];
  text?: string;
  error?: string;
};

const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const only = process.argv.find((argument) => argument.startsWith("--only="))?.slice("--only=".length).split(",");
  const contexts: Context[] = JSON.parse(await readFile(resolve("data-private/enem-oficial/contexts.json"), "utf8"));
  const prisma = getPrismaClient();
  const ready: (Context & { crops: string[]; pdf: string })[] = [];

  try {
    for (const context of contexts) {
      if (only && !only.includes(context.code)) continue;

      if (context.error || !context.crops?.length || !context.pdf) {
        console.log(`✗ ${context.code}: sem recorte (${context.error ?? "?"})`);
        continue;
      }

      const question = await prisma.question.findUnique({
        where: { id: context.id },
        select: { _count: { select: { supportLinks: true, mediaLinks: true } } },
      });

      if (!question) {
        console.log(`✗ ${context.code}: questão não encontrada`);
        continue;
      }

      if (question._count.supportLinks > 0 || question._count.mediaLinks > 0) {
        console.log(`= ${context.code}: já tem texto de apoio ou imagem — ignorada`);
        continue;
      }

      ready.push(context as Context & { crops: string[]; pdf: string });
      console.log(`✓ ${context.code} (ENEM ${context.year}, questão ${context.number}): ${context.crops.length} imagem(ns)`);
    }

    console.log(`\n${ready.length} questão(ões) prontas.`);

    if (!apply || ready.length === 0) {
      if (!apply) console.log("Dry-run only. Re-run with --apply to write.");
      return;
    }

    if (mediaStorageDriver() !== "supabase") {
      throw new Error("MEDIA_STORAGE_DRIVER=supabase is required.");
    }

    const storage = createSupabaseMediaStorage();
    const directory = resolve("data-private", "revisions");
    await mkdir(directory, { recursive: true });
    const logPath = resolve(directory, `attach-context-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    const log: { questionId: string; code: string; supportContentId: string; mediaLinkIds: string[] }[] = [];

    for (const context of ready) {
      const uploads: { checksum: string; storageKey: string; sizeBytes: bigint; file: string }[] = [];

      for (const crop of context.crops) {
        const bytes = await readFile(crop);
        const checksum = sha256(bytes);
        const storageKey = mediaStorageKey(checksum, "image/png");
        await storage.put({ storageKey, mimeType: "image/png", bytes: new Uint8Array(bytes) });
        uploads.push({ checksum, storageKey, sizeBytes: BigInt(bytes.byteLength), file: basename(crop) });
      }

      const altText = `Texto da questão ${context.number} do ENEM ${context.year} (prova oficial). ${context.text ?? ""}`
        .trim()
        .slice(0, 4000);

      const entry = await prisma.$transaction(async (transaction) => {
        const assetIds: string[] = [];
        const mediaLinkIds: string[] = [];

        for (const [position, upload] of uploads.entries()) {
          const asset = await transaction.mediaAsset.upsert({
            where: { checksum: upload.checksum },
            update: {},
            create: {
              checksum: upload.checksum,
              storageProvider: storage.provider,
              bucket: storage.bucket,
              storageKey: upload.storageKey,
              mimeType: "image/png",
              sizeBytes: upload.sizeBytes,
              altText,
              sourceUrl: `inep-official:${context.pdf}#questao=${context.number}`,
            },
            select: { id: true },
          });
          const link = await transaction.questionMediaLink.create({
            data: { questionId: context.id, mediaAssetId: asset.id, role: "QUESTION_ATTACHMENT", position },
            select: { id: true },
          });
          assetIds.push(asset.id);
          mediaLinkIds.push(link.id);
        }

        const content = assetIds.map((id) => `![Texto da prova oficial](media:${id})`).join("\n\n");
        const support = await transaction.questionSupportContent.upsert({
          where: { contentHash: sha256(normalizeQuestionText(content)) },
          update: {},
          create: { content, contentHash: sha256(normalizeQuestionText(content)) },
          select: { id: true },
        });
        await transaction.questionSupportLink.create({
          data: { questionId: context.id, supportContentId: support.id, position: 0 },
        });

        const question = await transaction.question.findUniqueOrThrow({
          where: { id: context.id },
          select: { status: true, statement: true },
        });

        await transaction.questionRevision.create({
          data: {
            questionId: context.id,
            editorProfileId: null,
            reason: `Contexto perdido na importação antiga restaurado pela prova oficial INEP (ENEM ${context.year}, questão ${context.number}, caderno azul).`,
            changedFields: ["supportContent", "media"],
            answerKeyChanged: false,
            questionStatus: question.status,
            before: { statement: question.statement, supportContents: [], media: [] },
            after: { statement: question.statement, supportContents: [content], media: assetIds },
          },
        });

        return { questionId: context.id, code: context.code, supportContentId: support.id, mediaLinkIds };
      });

      log.push(entry);
      await writeFile(
        logPath,
        JSON.stringify({ undo: "Delete these question_support_links and question_media_links (assets stay).", entries: log }, null, 2),
        "utf8",
      );
      console.log(`✓ ${context.code} restaurada.`);
    }

    console.log(`\nReversal log: ${logPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
