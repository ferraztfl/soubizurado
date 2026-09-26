import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import {
  join,
  relative,
  resolve,
  sep,
} from "node:path";

import type { OfficialExamAnalysis } from "../../application/official-exams/official-exam";

/*
 * Private, server-only storage for uploaded exam PDFs and their
 * analysis. Lives under data-private (git-ignored). Upload ids are
 * UUIDs validated on every access to prevent path traversal.
 */

export const MAX_EXAM_PDF_BYTES = 30 * 1024 * 1024;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const WORKSPACE_FILE_PATTERN = /^[\w.-]+\.(png|jpe?g|gif|webp)$/i;

export type OfficialExamImportResult = Readonly<{
  finishedAt: string;
  examinationSlug: string;
  jobIds: readonly string[];
  counts: Readonly<{
    received: number;
    imported: number;
    duplicates: number;
    reviewRequired: number;
    failed: number;
  }>;
  skippedAnnulled: number;
  mediaTasks: Readonly<{ completed: number; failed: number }>;
  classificationEnqueued: number;
}>;

export function officialExamsRoot(): string {
  return resolve(
    process.env.OFFICIAL_EXAMS_LOCAL_ROOT ?? "data-private/imports/official-exams",
  );
}

export function isValidUploadId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function uploadDirectory(uploadId: string): string {
  if (!isValidUploadId(uploadId)) {
    throw new Error("Invalid upload id.");
  }

  return join(officialExamsRoot(), uploadId.toLowerCase());
}

export function uploadPaths(uploadId: string) {
  const directory = uploadDirectory(uploadId);

  return {
    directory,
    booklet: join(directory, "prova.pdf"),
    answerKey: join(directory, "gabarito.pdf"),
    workspace: join(directory, "workspace"),
    analysis: join(directory, "analysis.json"),
    result: join(directory, "result.json"),
  };
}

function assertPdf(bytes: Uint8Array, label: string): void {
  if (bytes.byteLength === 0) {
    throw new Error(`${label}: arquivo vazio.`);
  }

  if (bytes.byteLength > MAX_EXAM_PDF_BYTES) {
    throw new Error(`${label}: arquivo maior que ${MAX_EXAM_PDF_BYTES / 1024 / 1024} MB.`);
  }

  if (Buffer.from(bytes.subarray(0, 5)).toString("latin1") !== "%PDF-") {
    throw new Error(`${label}: o arquivo não é um PDF válido.`);
  }
}

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function createUpload(
  input: Readonly<{
    booklet: Uint8Array;
    answerKey: Uint8Array;
  }>,
): Promise<string> {
  assertPdf(input.booklet, "Prova");
  assertPdf(input.answerKey, "Gabarito");

  const uploadId = randomUUID();
  const paths = uploadPaths(uploadId);

  await mkdir(paths.workspace, { recursive: true });
  await writeFile(paths.booklet, input.booklet);
  await writeFile(paths.answerKey, input.answerKey);

  return uploadId;
}

export async function saveAnalysis(analysis: OfficialExamAnalysis): Promise<void> {
  await writeFile(uploadPaths(analysis.uploadId).analysis, JSON.stringify(analysis, null, 2), "utf8");
}

export async function loadAnalysis(uploadId: string): Promise<OfficialExamAnalysis | null> {
  try {
    const parsed = JSON.parse(await readFile(uploadPaths(uploadId).analysis, "utf8")) as OfficialExamAnalysis;

    return parsed.version === 1 && parsed.uploadId === uploadId.toLowerCase() ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveResult(uploadId: string, result: OfficialExamImportResult): Promise<void> {
  await writeFile(uploadPaths(uploadId).result, JSON.stringify(result, null, 2), "utf8");
}

export async function loadResult(uploadId: string): Promise<OfficialExamImportResult | null> {
  try {
    return JSON.parse(await readFile(uploadPaths(uploadId).result, "utf8")) as OfficialExamImportResult;
  } catch {
    return null;
  }
}

/** Resolves an extracted image name inside the upload workspace. */
export function workspaceFile(uploadId: string, fileName: string): string | null {
  if (!WORKSPACE_FILE_PATTERN.test(fileName)) {
    return null;
  }

  const workspace = uploadPaths(uploadId).workspace;
  const target = resolve(workspace, fileName);
  const relation = relative(workspace, target);

  return relation && !relation.startsWith("..") && !relation.includes(sep) ? target : null;
}

export type UploadSummary = Readonly<{
  uploadId: string;
  createdAt: string;
  analysis: OfficialExamAnalysis | null;
  result: OfficialExamImportResult | null;
}>;

export async function listUploads(limit = 20): Promise<UploadSummary[]> {
  let entries: string[] = [];

  try {
    entries = (await readdir(officialExamsRoot())).filter(isValidUploadId);
  } catch {
    return [];
  }

  const summaries = await Promise.all(
    entries.map(async (uploadId) => {
      const [analysis, result, info] = await Promise.all([
        loadAnalysis(uploadId),
        loadResult(uploadId),
        stat(uploadDirectory(uploadId)).catch(() => null),
      ]);

      return {
        uploadId,
        createdAt: analysis?.createdAt ?? info?.mtime.toISOString() ?? "",
        analysis,
        result,
      };
    }),
  );

  return summaries
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}
