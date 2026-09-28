import { createHash } from "node:crypto";

import sharp from "sharp";

import {
  InvalidImageError,
  MAX_UPLOAD_BYTES,
  uploadPreparedImage,
  type PreparedImage,
} from "@/modules/question-bank/infrastructure/uploaded-question-image";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

/*
 * Organization logos for contests. Re-encoded with sharp (only real raster
 * images pass, metadata dropped), fitted into a 256×256 square and kept
 * transparent — logos sit on a white tile in the cards.
 */

const LOGO_SIZE = 256;
const ACCEPTED_FORMATS = new Set(["png", "jpeg", "webp", "gif", "svg"]);

export async function prepareContestLogo(file: File): Promise<PreparedImage> {
  if (file.size > MAX_UPLOAD_BYTES) throw new InvalidImageError(`A logo "${file.name}" passa de 8 MB.`);

  try {
    const image = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40_000_000, animated: false });
    const metadata = await image.metadata();

    if (!metadata.format || !ACCEPTED_FORMATS.has(metadata.format)) {
      throw new InvalidImageError(`"${file.name}" não é uma imagem PNG, JPG, WebP, GIF ou SVG.`);
    }

    const { data, info } = await image
      .rotate()
      .trim({ threshold: 10 })
      .resize({ width: LOGO_SIZE, height: LOGO_SIZE, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 90, alphaQuality: 100 })
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
    throw new InvalidImageError(`Não foi possível ler a logo "${file.name}".`);
  }
}

/** Uploads a logo to the private bucket (content-addressed) and returns its media asset id. */
export async function storeContestLogo(file: File, organizationName: string): Promise<string> {
  const prepared = await prepareContestLogo(file);
  const upload = await uploadPreparedImage(prepared);
  const asset = await getPrismaClient().mediaAsset.upsert({
    where: { checksum: prepared.checksum },
    update: {},
    create: {
      checksum: prepared.checksum,
      storageProvider: upload.provider,
      bucket: upload.bucket,
      storageKey: upload.storageKey,
      mimeType: prepared.mimeType,
      sizeBytes: BigInt(prepared.bytes.byteLength),
      width: prepared.width,
      height: prepared.height,
      altText: `Logo: ${organizationName}`.slice(0, 500),
      sourceUrl: "admin-contest-logo",
    },
    select: { id: true },
  });
  return asset.id;
}
