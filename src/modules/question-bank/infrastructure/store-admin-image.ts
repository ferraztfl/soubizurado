import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import { prepareUploadedImage, uploadPreparedImage } from "./uploaded-question-image";

/**
 * Stores an image an administrator uploaded (decoded and re-encoded as WebP,
 * private bucket, content-addressed) and returns its media asset id. Throws
 * InvalidImageError for anything that is not a real image.
 */
export async function storeAdminImage(file: File, alt: string, origin: string): Promise<string> {
  const prepared = await prepareUploadedImage(file);
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
      altText: alt.slice(0, 500),
      sourceUrl: origin,
    },
    select: { id: true },
  });

  return asset.id;
}
