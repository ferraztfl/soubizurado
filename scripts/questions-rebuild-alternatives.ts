import "dotenv/config";

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import { z } from "zod";

import { mediaStorageKey } from "../src/modules/imports/application/services/process-media-queue";
import { getPrismaClient } from "../src/shared/infrastructure/database/prisma";
import { createSupabaseMediaStorage, mediaStorageDriver } from "../src/shared/infrastructure/media-storage/stored-media";

/*
 * Rebuilds the alternatives and the answer key of questions whose import
 * lost alternatives (e.g. ENEM "0" dropped by the old source), from a
 * reviewed corrections file written against the official booklet.
 *
 * Existing alternatives keep their ids (student attempts point at them) and
 * are matched by text, by the damaged text they `replace`, or — for
 * image-only alternatives — by their `currentLabel`; only letter / position /
 * correctness (and a replaced text) change. Missing alternatives are
 * created; an `image` crop of the official PDF becomes a new alternative's
 * picture (uploaded to Storage like imported media). Nothing is deleted: an
 * existing alternative absent from the official list aborts that question.
 * Every change writes a question_revisions row (before / after), and the
 * answer key becomes VERIFIED. The question status is not touched.
 *
 *   npm run questions:rebuild-alternatives -- <corrections.json>          # dry-run (writes crop previews)
 *   npm run questions:rebuild-alternatives -- <corrections.json> --apply  # writes, after a reversal log
 */

const imageSchema = z.object({
  pdf: z.string().min(1),
  page: z.number().int().positive(),
  dpi: z.number().int().min(72).max(600),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const alternativeSchema = z
  .object({
    label: z.string().regex(/^[A-E]$/),
    content: z.string().max(5000).default(""),
    /** Current (damaged) text of this alternative; its text becomes `content`. */
    replaces: z.string().min(1).optional(),
    /** Current letter of an existing alternative (image-only alternatives have no text to match). */
    currentLabel: z.string().regex(/^[A-E]$/).optional(),
    /** New alternative whose picture is cropped from the official booklet. */
    image: imageSchema.optional(),
  })
  .refine((item) => item.content.trim().length > 0 || item.image || item.currentLabel, {
    message: "An alternative needs content, an image or a currentLabel.",
  });

const correctionsSchema = z.object({
  source: z.string().min(5),
  corrections: z
    .array(
      z.object({
        code: z.string().regex(/^Q\d{5,9}$/),
        officialNumber: z.number().int().positive(),
        reason: z.string().min(10).max(500),
        alternatives: z.array(alternativeSchema).min(2),
        correctLabel: z.string().regex(/^[A-E]$/),
      }),
    )
    .min(1),
});

type ImageSpec = z.infer<typeof imageSchema>;

type Snapshot = {
  statement: string;
  correctTrueFalse: boolean | null;
  answerKeyStatus: string;
  alternatives: { id: string; label: string; content: string; isCorrect: boolean }[];
};

type Plan = {
  questionId: string;
  code: string;
  reason: string;
  answerKeyChanged: boolean;
  before: Snapshot;
  after: Snapshot;
  updates: { id: string; label: string; position: number; isCorrect: boolean; content?: string }[];
  creates: { label: string; position: number; content: string; isCorrect: boolean; image?: ImageSpec }[];
};

const normalize = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.;]$/, "")
    .toLowerCase();

const CROP_DIR = resolve("data-private", "enem-oficial", "crops");

/** Crops a page region of the official PDF to PNG (poppler's pdftoppm). */
async function cropImage(image: ImageSpec, name: string): Promise<{ path: string; bytes: Buffer }> {
  await mkdir(CROP_DIR, { recursive: true });
  const prefix = join(CROP_DIR, name);
  execFileSync("pdftoppm", [
    "-f", String(image.page), "-l", String(image.page), "-r", String(image.dpi),
    "-x", String(image.x), "-y", String(image.y), "-W", String(image.width), "-H", String(image.height),
    "-png", "-singlefile", resolve(image.pdf), prefix,
  ]);
  const path = `${prefix}.png`;

  return { path, bytes: await readFile(path) };
}

async function main(): Promise<void> {
  const file = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
  const apply = process.argv.includes("--apply");

  if (!file) {
    throw new Error("Usage: questions:rebuild-alternatives -- <corrections.json> [--apply]");
  }

  const input = correctionsSchema.parse(JSON.parse(await readFile(file, "utf8")));
  const prisma = getPrismaClient();
  const plans: Plan[] = [];

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
      const updates: Plan["updates"] = [];
      const creates: Plan["creates"] = [];
      const afterAlternatives: Snapshot["alternatives"] = [];
      let invalid: string | null = null;

      for (const [position, official] of correction.alternatives.entries()) {
        const isCorrect = official.label === correction.correctLabel;
        const candidates = [...unused.values()];
        const textToMatch = normalize(official.replaces ?? official.content);
        // Empty texts (image-only alternatives) never match by text: use currentLabel.
        const match = official.currentLabel
          ? candidates.find((item) => item.label === official.currentLabel)
          : textToMatch
            ? candidates.find((item) => normalize(item.content) === textToMatch)
            : undefined;

        if (official.currentLabel && !match) {
          invalid = `não há alternativa atual com a letra ${official.currentLabel}`;
          break;
        }

        if (match) {
          unused.delete(match.id);
          const content = official.replaces ? official.content : undefined;
          updates.push({ id: match.id, label: official.label, position, isCorrect, ...(content ? { content } : {}) });
          afterAlternatives.push({ id: match.id, label: official.label, content: content ?? match.content, isCorrect });
        } else {
          creates.push({
            label: official.label,
            position,
            content: official.content,
            isCorrect,
            ...(official.image ? { image: official.image } : {}),
          });
          afterAlternatives.push({
            id: "(nova)",
            label: official.label,
            content: official.content || (official.image ? "[imagem recortada da prova oficial]" : ""),
            isCorrect,
          });
        }
      }

      if (invalid) {
        console.log(`✗ ${correction.code}: ${invalid}. Nada será feito.`);
        continue;
      }

      if (unused.size > 0) {
        const leftovers = [...unused.values()].map((item) => `${item.label}) ${item.content}`).join("; ");
        console.log(`✗ ${correction.code}: alternativas atuais que não estão na lista oficial (${leftovers}). Nada será feito.`);
        continue;
      }

      const unchanged =
        creates.length === 0 &&
        updates.every((update) => {
          const current = question.alternatives.find((item) => item.id === update.id)!;
          return (
            current.label === update.label &&
            current.isCorrect === update.isCorrect &&
            (update.content === undefined || current.content === update.content) &&
            question.alternatives.indexOf(current) === update.position
          );
        });

      if (unchanged && question.answerKeyStatus === "VERIFIED") {
        console.log(`= ${correction.code}: já está conforme a prova oficial.`);
        continue;
      }

      const before: Snapshot = {
        statement: question.statement,
        correctTrueFalse: question.correctTrueFalse,
        answerKeyStatus: question.answerKeyStatus,
        alternatives: question.alternatives,
      };
      const after: Snapshot = { ...before, answerKeyStatus: "VERIFIED", alternatives: afterAlternatives };
      const correctBefore = before.alternatives.find((item) => item.isCorrect)?.id ?? null;
      const correctAfter = afterAlternatives.find((item) => item.isCorrect)?.id ?? null;

      plans.push({
        questionId: question.id,
        code: correction.code,
        reason: correction.reason,
        answerKeyChanged: correctBefore !== correctAfter,
        before,
        after,
        updates,
        creates,
      });

      const show = (alternatives: Snapshot["alternatives"]) =>
        alternatives.map((item) => `${item.label}${item.isCorrect ? "*" : ""}) ${item.content || "[imagem]"}`).join("  ");
      console.log(`\n${correction.code} (questão oficial ${correction.officialNumber})${correctBefore !== correctAfter ? " — GABARITO MUDA" : ""}`);
      console.log(`  antes:  ${show(before.alternatives)}`);
      console.log(`  depois: ${show(after.alternatives)}`);

      for (const create of creates.filter((item) => item.image)) {
        const preview = await cropImage(create.image!, `${correction.code}-${create.label}`);
        console.log(`  recorte ${create.label}: ${preview.path} (${preview.bytes.byteLength} bytes) — confira antes de aplicar`);
      }
    }

    if (!apply || plans.length === 0) {
      if (!apply) console.log("\nDry-run only. Re-run with --apply to write.");
      return;
    }

    const needsStorage = plans.some((plan) => plan.creates.some((create) => create.image));

    if (needsStorage && mediaStorageDriver() !== "supabase") {
      throw new Error("Image alternatives need MEDIA_STORAGE_DRIVER=supabase.");
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
          undo: "Per question: delete the created alternatives (and their media links), restore labels/positions/isCorrect/content and answer_key_status from `before`.",
          plans,
        },
        null,
        2,
      ),
      "utf8",
    );
    console.log(`\nReversal log: ${logPath}`);

    const storage = needsStorage ? createSupabaseMediaStorage() : null;

    for (const plan of plans) {
      // Upload crops first: keys are content-addressed, so a retry is harmless.
      const uploads = new Map<string, { checksum: string; storageKey: string; sizeBytes: bigint }>();

      for (const create of plan.creates.filter((item) => item.image)) {
        const crop = await cropImage(create.image!, `${plan.code}-${create.label}`);
        const checksum = createHash("sha256").update(crop.bytes).digest("hex");
        const storageKey = mediaStorageKey(checksum, "image/png");
        await storage!.put({ storageKey, mimeType: "image/png", bytes: new Uint8Array(crop.bytes) });
        uploads.set(create.label, { checksum, storageKey, sizeBytes: BigInt(crop.bytes.byteLength) });
      }

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
          const alternative = await transaction.questionAlternative.create({
            data: {
              questionId: plan.questionId,
              label: create.label,
              position: create.position,
              content: create.content,
              isCorrect: create.isCorrect,
            },
            select: { id: true },
          });
          const upload = uploads.get(create.label);

          if (upload) {
            const asset = await transaction.mediaAsset.upsert({
              where: { checksum: upload.checksum },
              update: {},
              create: {
                checksum: upload.checksum,
                storageProvider: storage!.provider,
                bucket: storage!.bucket,
                storageKey: upload.storageKey,
                mimeType: "image/png",
                sizeBytes: upload.sizeBytes,
                altText: `Alternativa ${create.label}`,
                sourceUrl: `inep-official:${basename(create.image!.pdf)}#page=${create.image!.page}`,
              },
              select: { id: true },
            });

            await transaction.questionAlternativeMediaLink.create({
              data: { alternativeId: alternative.id, mediaAssetId: asset.id, position: 0 },
            });
          }
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
            changedFields: plan.answerKeyChanged ? ["alternatives", "answerKey"] : ["alternatives"],
            answerKeyChanged: plan.answerKeyChanged,
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
