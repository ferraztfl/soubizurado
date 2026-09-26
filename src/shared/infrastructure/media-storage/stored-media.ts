import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { resolveLocalPublicMediaPath } from "@/modules/question-bank/infrastructure/media/local-public-media";

import {
  getSupabaseStorageClient,
  isSupabaseStorageConfigured,
  mediaBucketName,
} from "./supabase-storage-client";
import {
  SUPABASE_STORAGE_PROVIDER,
  SupabaseMediaStorage,
} from "./supabase-media-storage";

export const LOCAL_FS_PROVIDER = "LOCAL_FS";

export function localMediaRoot(): string {
  return resolve(process.env.MEDIA_STORAGE_LOCAL_ROOT ?? "data-private/media-store");
}

/**
 * Where new media is written: "supabase" once Storage is configured
 * and the migration ran, "local" otherwise (development default).
 */
export function mediaStorageDriver(): "local" | "supabase" {
  return process.env.MEDIA_STORAGE_DRIVER?.trim().toLowerCase() === "supabase" ? "supabase" : "local";
}

export function createSupabaseMediaStorage(): SupabaseMediaStorage {
  return new SupabaseMediaStorage({
    client: getSupabaseStorageClient(),
    bucket: mediaBucketName(),
  });
}

/**
 * Reads stored media bytes for any provider recorded on MediaAsset.
 * Returns null when the object does not exist (callers answer 404).
 */
export async function readStoredMedia(
  asset: Readonly<{
    storageProvider: string;
    bucket: string;
    storageKey: string;
  }>,
): Promise<Uint8Array | null> {
  if (asset.storageProvider === LOCAL_FS_PROVIDER) {
    let path: string;

    try {
      path = resolveLocalPublicMediaPath({
        rootDirectory: localMediaRoot(),
        storageKey: asset.storageKey,
      });
    } catch {
      return null;
    }

    try {
      return new Uint8Array(await readFile(path));
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        return null;
      }

      throw error;
    }
  }

  if (asset.storageProvider === SUPABASE_STORAGE_PROVIDER && isSupabaseStorageConfigured()) {
    return new SupabaseMediaStorage({
      client: getSupabaseStorageClient(),
      bucket: asset.bucket,
    }).read(asset.storageKey);
  }

  return null;
}
