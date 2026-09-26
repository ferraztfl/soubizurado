import "dotenv/config";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { resolveLocalPublicMediaPath } from "../src/modules/question-bank/infrastructure/media/local-public-media";
import { getPrismaClient } from "../src/shared/infrastructure/database/prisma";
import {
  getSupabaseStorageClient,
  isSupabaseStorageConfigured,
  mediaBucketName,
} from "../src/shared/infrastructure/media-storage/supabase-storage-client";
import {
  SUPABASE_STORAGE_PROVIDER,
  SupabaseMediaStorage,
} from "../src/shared/infrastructure/media-storage/supabase-media-storage";
import {
  LOCAL_FS_PROVIDER,
  localMediaRoot,
} from "../src/shared/infrastructure/media-storage/stored-media";

/*
 * Copies LOCAL_FS media assets to the private Supabase Storage bucket.
 *
 * Per asset: verify local size + sha256 against the database, upload,
 * download back and verify sha256 again, then switch the MediaAsset to
 * SUPABASE_STORAGE. Resumable (only LOCAL_FS rows are processed) and
 * never deletes local files.
 *
 *   npm run media:migrate-supabase                 # dry-run: validates local files
 *   npm run media:migrate-supabase -- --apply
 *   npm run media:migrate-supabase -- --apply --limit=100 --concurrency=4
 */

const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/svg+xml",
  "application/pdf",
];

function argumentValue(name: string): string | undefined {
  const prefix = `--${name}=`;

  return process.argv
    .slice(2)
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function ensurePrivateBucket(bucket: string, apply: boolean): Promise<"exists" | "created" | "missing"> {
  const storage = getSupabaseStorageClient().storage;
  const { data, error } = await storage.getBucket(bucket);

  if (data) {
    if (data.public) {
      throw new Error(`Bucket "${bucket}" is PUBLIC. Media of unpublished questions must stay private; make it private first.`);
    }

    return "exists";
  }

  if (error && !/not found|does not exist/i.test(error.message)) {
    throw new Error(`Could not read bucket "${bucket}": ${error.message}`);
  }

  if (!apply) {
    return "missing";
  }

  const created = await storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: "25MB",
    allowedMimeTypes: ALLOWED_MIME_TYPES,
  });

  if (created.error) {
    throw new Error(`Could not create bucket "${bucket}": ${created.error.message}`);
  }

  return "created";
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing from the environment.");
  }

  if (!isSupabaseStorageConfigured()) {
    throw new Error("Set SUPABASE_SECRET_KEY in .env (server only) before migrating media.");
  }

  const apply = process.argv.slice(2).includes("--apply");
  const limit = Number(argumentValue("limit") ?? "100000");
  const concurrency = Math.min(8, Math.max(1, Number(argumentValue("concurrency") ?? "4")));
  const bucket = mediaBucketName();
  const prisma = getPrismaClient();

  try {
    const bucketState = await ensurePrivateBucket(bucket, apply);
    const assets = await prisma.mediaAsset.findMany({
      where: { storageProvider: LOCAL_FS_PROVIDER },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: { id: true, storageKey: true, checksum: true, sizeBytes: true, mimeType: true },
    });

    const storage = new SupabaseMediaStorage({ client: getSupabaseStorageClient(), bucket });
    const tally = { migrated: 0, valid: 0, missing: 0, mismatch: 0, failed: 0 };
    const problems: string[] = [];
    let next = 0;

    async function worker(): Promise<void> {
      while (next < assets.length) {
        const asset = assets[next]!;
        next += 1;

        let bytes: Uint8Array;

        try {
          bytes = new Uint8Array(
            await readFile(
              resolveLocalPublicMediaPath({ rootDirectory: localMediaRoot(), storageKey: asset.storageKey }),
            ),
          );
        } catch {
          tally.missing += 1;
          problems.push(`${asset.id}: local file missing (${asset.storageKey})`);
          continue;
        }

        if (BigInt(bytes.byteLength) !== asset.sizeBytes || sha256(bytes) !== asset.checksum) {
          tally.mismatch += 1;
          problems.push(`${asset.id}: local size/checksum mismatch`);
          continue;
        }

        tally.valid += 1;

        if (!apply) {
          continue;
        }

        try {
          await storage.put({ storageKey: asset.storageKey, mimeType: asset.mimeType, bytes });
          const remote = await storage.read(asset.storageKey);

          if (!remote || sha256(remote) !== asset.checksum) {
            throw new Error("remote checksum mismatch after upload");
          }

          await prisma.mediaAsset.updateMany({
            where: { id: asset.id, storageProvider: LOCAL_FS_PROVIDER },
            data: { storageProvider: SUPABASE_STORAGE_PROVIDER, bucket },
          });

          tally.migrated += 1;

          if (tally.migrated % 100 === 0) {
            console.log(`migrated ${tally.migrated}/${assets.length}`);
          }
        } catch (error) {
          tally.failed += 1;
          problems.push(`${asset.id}: ${error instanceof Error ? error.message : "upload failed"}`);
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    const remainingLocal = await prisma.mediaAsset.count({ where: { storageProvider: LOCAL_FS_PROVIDER } });

    console.log(
      JSON.stringify(
        {
          mode: apply ? "apply" : "dry-run",
          bucket,
          bucketState,
          localAssetsChecked: assets.length,
          ...tally,
          remainingLocal,
          problems: problems.slice(0, 20),
        },
        null,
        2,
      ),
    );

    if (!apply) {
      console.log("Dry-run only. Re-run with --apply to upload and switch assets.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
