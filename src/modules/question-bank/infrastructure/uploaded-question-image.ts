import { createHash } from "node:crypto";

import sharp from "sharp";

import { mediaStorageKey } from "@/modules/imports/application/services/process-media-queue";
import { createSupabaseMediaStorage } from "@/shared/infrastructure/media-storage/stored-media";

/*
 * Images uploaded by an admin for a question (statement or alternative).
 * Server-only. Every file is decoded and re-encoded with sharp: only real
 * raster images pass, metadata (EXIF, GPS) is dropped, and the stored
 * format is always WebP with bounded dimensions — nothing the browser
 * sent is stored as is.
 */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_WIDTH = 1600;
const MAX_INPUT_PIXELS = 40_000_000;
const ACCEPTED_FORMATS = new Set(["png", "jpeg", "webp", "gif"]);

export type PreparedImage = Readonly<{
  bytes: Uint8Array;
  mimeType: "image/webp";
  checksum: string;
  width: number;
  height: number;
}>;

export class InvalidImageError extends Error {}

export function isFilledFile(value: FormDataEntryValue | null): value is File {
  return typeof value === "object" && value !== null && "arrayBuffer" in value && value.size > 0;
}

export async function prepareUploadedImage(file: File): Promise<PreparedImage> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new InvalidImageError(`A imagem "${file.name}" passa de 8 MB.`);
  }

  const input = Buffer.from(await file.arrayBuffer());

  try {
    const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, animated: false });
    const metadata = await image.metadata();

    if (!metadata.format || !ACCEPTED_FORMATS.has(metadata.format)) {
      throw new InvalidImageError(`"${file.name}" não é uma imagem PNG, JPG, WebP ou GIF.`);
    }

    const { data, info } = await image
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .webp({ quality: 88 })
      .toBuffer({ resolveWithObject: true });

    return {
      bytes: new Uint8Array(data),
      mimeType: "image/webp",
      checksum: createHash("sha256").update(data).digest("hex"),
      width: info.width,
      height: info.height,
    };
  } catch (error) {
    if (error instanceof InvalidImageError) throw error;
    throw new InvalidImageError(`Não foi possível ler a imagem "${file.name}".`);
  }
}

/** Uploads to the private bucket (content-addressed, idempotent); returns the key. */
export async function uploadPreparedImage(image: PreparedImage): Promise<Readonly<{ storageKey: string; provider: string; bucket: string }>> {
  const storage = createSupabaseMediaStorage();
  const storageKey = mediaStorageKey(image.checksum, image.mimeType);

  await storage.put({ storageKey, mimeType: image.mimeType, bytes: image.bytes });

  return { storageKey, provider: storage.provider, bucket: storage.bucket };
}
