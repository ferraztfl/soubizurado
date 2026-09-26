import {
  createSupabaseMediaStorage,
  localMediaRoot,
  mediaStorageDriver,
} from "@/shared/infrastructure/media-storage/stored-media";

import type { MediaStorage } from "../../application/ports/media-ingestion";

import { LocalMediaStorage } from "./local-media-storage";

/**
 * Storage for newly ingested media, chosen by MEDIA_STORAGE_DRIVER:
 * "supabase" (private Supabase Storage bucket, production) or "local"
 * (data-private/media-store, development default).
 */
export function createMediaStorage(): MediaStorage {
  if (mediaStorageDriver() === "supabase") {
    return createSupabaseMediaStorage();
  }

  return new LocalMediaStorage({
    rootDirectory: localMediaRoot(),
    bucket: process.env.MEDIA_STORAGE_BUCKET ?? "question-media",
  });
}
