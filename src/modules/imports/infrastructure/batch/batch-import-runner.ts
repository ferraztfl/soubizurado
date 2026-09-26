import { runClassificationBatch } from "@/modules/classification/infrastructure/run-classification-batch";

import { pairExamFiles, type PairingResult } from "../../application/batch/pair-exam-files";
import { analyzeOfficialExam } from "../official-exams/analyze-official-exam";
import { confirmOfficialExamImport } from "../official-exams/confirm-official-exam-import";
import { createUpload, loadResult, saveAnalysis } from "../official-exams/official-exam-upload-store";

import {
  archiveInboxFiles,
  listInboxFiles,
  loadBatch,
  newBatchManifest,
  readInboxFile,
  saveBatch,
  type BatchItem,
  type BatchManifest,
} from "./batch-import-store";

/*
 * Background batch runs: analyze every pair found in the inbox, then
 * import the ready ones with the automatic metadata and section mapping.
 * One run at a time per server process; progress lives in the manifest
 * file, so the page survives reloads and a restarted server just shows
 * the last saved state.
 */

const holder = globalThis as typeof globalThis & { __batchImportBusy?: boolean };

export function isBatchRunning(): boolean {
  return holder.__batchImportBusy === true;
}

export async function previewInbox(): Promise<PairingResult> {
  return pairExamFiles(await listInboxFiles());
}

function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 300) : "Erro inesperado.";
}

async function analyzeItem(item: BatchItem): Promise<void> {
  try {
    const uploadId = await createUpload({
      booklet: await readInboxFile(item.booklet),
      answerKey: await readInboxFile(item.answerKey),
    });
    const analysis = await analyzeOfficialExam(uploadId, {
      booklet: fileName(item.booklet),
      answerKey: fileName(item.answerKey),
    });

    await saveAnalysis(analysis);

    item.uploadId = uploadId;
    item.reader = analysis.board;
    item.questions = analysis.questions.length;
    item.importable = analysis.questions.filter((question) => !question.annulled && question.answer).length;
    item.issues = analysis.blockingIssues.slice(0, 5);
    item.boardSlug = analysis.suggestedBoardSlug ?? null;
    item.organization = analysis.detected.organization;
    item.careerPosition = analysis.detected.careerPosition;
    item.year = analysis.detected.year;

    const complete = Boolean(item.boardSlug && item.organization && item.careerPosition && item.year);

    item.state = analysis.blockingIssues.length > 0 ? "BLOCKED" : complete ? "READY" : "NEEDS_REVIEW";
  } catch (error) {
    item.state = "FAILED";
    item.error = errorMessage(error);
  }
}

/** Starts analyzing the inbox. Returns the batch id, or null when busy or empty. */
export async function startBatchAnalysis(): Promise<string | null> {
  if (isBatchRunning()) {
    return null;
  }

  const { pairs, unpaired } = await previewInbox();

  if (pairs.length === 0) {
    return null;
  }

  const manifest = newBatchManifest(
    pairs.map((pair) => ({
      ...pair,
      uploadId: null,
      state: "PENDING",
      reader: null,
      questions: 0,
      importable: 0,
      issues: [],
      boardSlug: null,
      organization: null,
      careerPosition: null,
      year: null,
      imported: null,
      duplicates: null,
      error: null,
    })),
    [...unpaired],
  );

  await saveBatch(manifest);
  holder.__batchImportBusy = true;

  void (async () => {
    try {
      for (const item of manifest.items) {
        await analyzeItem(item);
        await saveBatch(manifest);
      }

      await archiveInboxFiles(
        manifest.id,
        manifest.items.flatMap((item) => [item.booklet, item.answerKey]),
      );
      manifest.status = "ANALYZED";
      manifest.finishedAt = new Date().toISOString();
      await saveBatch(manifest);
    } finally {
      holder.__batchImportBusy = false;
    }
  })();

  return manifest.id;
}

/**
 * Items confirmed one by one in the preview are recognized as imported,
 * so the batch never imports them twice.
 */
export async function refreshImportedItems(manifest: BatchManifest): Promise<boolean> {
  let changed = false;

  for (const item of manifest.items) {
    if (item.uploadId && item.state !== "IMPORTED") {
      const result = await loadResult(item.uploadId);

      if (result) {
        item.state = "IMPORTED";
        item.imported = result.counts.imported;
        item.duplicates = result.counts.duplicates;
        item.error = null;
        changed = true;
      }
    }
  }

  return changed;
}

/** Imports every READY item of a batch, then classifies once. */
export async function startBatchImport(batchId: string): Promise<boolean> {
  if (isBatchRunning()) {
    return false;
  }

  const manifest = await loadBatch(batchId);

  if (!manifest) {
    return false;
  }

  // A run cut short by a server restart: items it was importing go back
  // to READY (already imported ones are recognized by their result).
  if (manifest.status === "IMPORTING") {
    manifest.items.forEach((item) => {
      if (item.state === "IMPORTING") {
        item.state = "READY";
      }
    });
    manifest.status = "ANALYZED";
  }

  if (manifest.status === "ANALYZING") {
    return false;
  }

  await refreshImportedItems(manifest);

  const ready = manifest.items.filter((item) => item.state === "READY" && item.uploadId);

  if (ready.length === 0) {
    await saveBatch(manifest);
    return false;
  }

  manifest.status = "IMPORTING";
  await saveBatch(manifest);
  holder.__batchImportBusy = true;

  void (async () => {
    let enqueued = 0;

    try {
      for (const item of ready) {
        item.state = "IMPORTING";
        await saveBatch(manifest);

        try {
          const result = await confirmOfficialExamImport({
            uploadId: item.uploadId!,
            boardSlug: item.boardSlug ?? "",
            organization: item.organization,
            careerPosition: item.careerPosition,
            year: item.year,
          });

          item.state = "IMPORTED";
          item.imported = result.counts.imported;
          item.duplicates = result.counts.duplicates;
          enqueued += result.classificationEnqueued;
        } catch (error) {
          item.state = "IMPORT_FAILED";
          item.error = errorMessage(error);
        }

        await saveBatch(manifest);
      }

      manifest.classificationEnqueued += enqueued;
      manifest.status = "DONE";
      manifest.finishedAt = new Date().toISOString();
      await saveBatch(manifest);

      // One classification run for the whole batch (rules → AI).
      if (enqueued > 0) {
        await runClassificationBatch({ limit: enqueued }).catch((error: unknown) => {
          console.error(`[batch ${manifest.id}] classification: ${errorMessage(error)}`);
        });
      }
    } finally {
      holder.__batchImportBusy = false;
    }
  })();

  return true;
}
