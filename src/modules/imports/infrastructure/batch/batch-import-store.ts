import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rmdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

/*
 * Server-only storage of the batch import queue, under data-private
 * (git-ignored). The administrator drops PDFs into the inbox folder;
 * each run becomes a batch manifest, and the original files are moved
 * into the batch folder once analyzed.
 */

export type BatchItemState =
  | "PENDING"
  | "READY"
  | "NEEDS_REVIEW"
  | "BLOCKED"
  | "FAILED"
  | "IMPORTING"
  | "IMPORTED"
  | "IMPORT_FAILED";

export type BatchItem = {
  label: string;
  booklet: string;
  answerKey: string;
  uploadId: string | null;
  state: BatchItemState;
  reader: string | null;
  questions: number;
  importable: number;
  issues: string[];
  boardSlug: string | null;
  organization: string | null;
  careerPosition: string | null;
  year: number | null;
  imported: number | null;
  duplicates: number | null;
  error: string | null;
};

export type BatchManifest = {
  id: string;
  createdAt: string;
  status: "ANALYZING" | "ANALYZED" | "IMPORTING" | "DONE";
  finishedAt: string | null;
  items: BatchItem[];
  unpaired: { file: string; reason: string }[];
  classificationEnqueued: number;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function batchInboxRoot(): string {
  return resolve(process.env.BATCH_IMPORT_INBOX ?? "data-private/imports/lote-entrada");
}

function batchesRoot(): string {
  return resolve("data-private/imports/lotes");
}

function manifestPath(batchId: string): string {
  if (!UUID_PATTERN.test(batchId)) {
    throw new Error("Invalid batch id.");
  }

  return join(batchesRoot(), batchId.toLowerCase(), "lote.json");
}

/** Relative paths ("/" separators) of the files in the inbox, two levels deep. */
export async function listInboxFiles(): Promise<string[]> {
  const root = batchInboxRoot();
  await mkdir(root, { recursive: true });

  const files: string[] = [];

  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isFile()) {
      files.push(entry.name);
    } else if (entry.isDirectory()) {
      for (const inner of await readdir(join(root, entry.name), { withFileTypes: true })) {
        if (inner.isFile()) {
          files.push(`${entry.name}/${inner.name}`);
        }
      }
    }
  }

  return files;
}

export async function readInboxFile(relativePath: string): Promise<Uint8Array> {
  const root = batchInboxRoot();
  const full = resolve(root, relativePath);

  if (!full.startsWith(root)) {
    throw new Error("Invalid inbox path.");
  }

  return new Uint8Array(await readFile(full));
}

export function newBatchManifest(items: BatchItem[], unpaired: BatchManifest["unpaired"]): BatchManifest {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    status: "ANALYZING",
    finishedAt: null,
    items,
    unpaired,
    classificationEnqueued: 0,
  };
}

export async function saveBatch(manifest: BatchManifest): Promise<void> {
  const path = manifestPath(manifest.id);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(manifest, null, 2), "utf8");
}

export async function loadBatch(batchId: string): Promise<BatchManifest | null> {
  try {
    return JSON.parse(await readFile(manifestPath(batchId), "utf8")) as BatchManifest;
  } catch {
    return null;
  }
}

export async function listBatches(limit = 10): Promise<BatchManifest[]> {
  await mkdir(batchesRoot(), { recursive: true });

  const manifests = await Promise.all(
    (await readdir(batchesRoot(), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && UUID_PATTERN.test(entry.name))
      .map((entry) => loadBatch(entry.name)),
  );

  return manifests
    .filter((manifest): manifest is BatchManifest => manifest !== null)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

/** Moves analyzed inbox files into the batch folder, keeping subfolders. */
export async function archiveInboxFiles(batchId: string, relativePaths: readonly string[]): Promise<void> {
  const root = batchInboxRoot();
  const target = join(dirname(manifestPath(batchId)), "originais");

  for (const relativePath of new Set(relativePaths)) {
    const source = resolve(root, relativePath);

    if (!source.startsWith(root)) {
      continue;
    }

    const destination = join(target, ...relativePath.split("/"));
    await mkdir(dirname(destination), { recursive: true });

    try {
      await rename(source, destination);
    } catch {
      // Already moved (shared answer key) or locked: leave it.
    }
  }

  // Remove subfolders left empty (rmdir refuses non-empty folders).
  for (const folder of new Set(relativePaths.filter((path) => path.includes("/")).map((path) => path.split("/")[0]!))) {
    await rmdir(resolve(root, folder)).catch(() => undefined);
  }
}
