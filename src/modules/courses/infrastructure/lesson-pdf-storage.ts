import { createHash } from "node:crypto";

import { mediaStorageKey } from "@/modules/imports/application/services/process-media-queue";
import { createSupabaseMediaStorage } from "@/shared/infrastructure/media-storage/stored-media";

/*
 * Lesson PDFs: uploaded by admins into the private bucket (content-addressed)
 * and served only through the protected lesson route, never publicly.
 */

export const MAX_PDF_BYTES = 50 * 1024 * 1024;

export class InvalidPdfError extends Error {}

export type UploadedPdf = Readonly<{
  sizeBytes: number;
  checksum: string;
  storageKey: string;
  provider: string;
  bucket: string;
}>;

export async function uploadLessonPdf(file: File): Promise<UploadedPdf> {
  if (file.size > MAX_PDF_BYTES) {
    throw new InvalidPdfError("O PDF passa de 50 MB.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // A real PDF starts with "%PDF-" (the file name and browser type are not trusted).
  if (bytes.length < 5 || Buffer.from(bytes.subarray(0, 5)).toString("latin1") !== "%PDF-") {
    throw new InvalidPdfError(`"${file.name}" não é um PDF válido.`);
  }

  const checksum = createHash("sha256").update(bytes).digest("hex");
  const storage = createSupabaseMediaStorage();
  const storageKey = mediaStorageKey(checksum, "application/pdf");

  await storage.put({ storageKey, mimeType: "application/pdf", bytes });

  return { sizeBytes: bytes.byteLength, checksum, storageKey, provider: storage.provider, bucket: storage.bucket };
}
