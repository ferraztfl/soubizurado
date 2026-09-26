import type { SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_STORAGE_PROVIDER = "SUPABASE_STORAGE";

type StorageClient = Pick<SupabaseClient, "storage">;

export type SupabaseMediaStorageOptions = Readonly<{
  client: StorageClient;
  bucket: string;
}>;

function isAlreadyExists(error: { message?: string; statusCode?: string | number } | null): boolean {
  if (!error) {
    return false;
  }

  return (
    String(error.statusCode ?? "") === "409" ||
    /already exists|duplicate/i.test(error.message ?? "")
  );
}

/**
 * Media storage backed by a PRIVATE Supabase Storage bucket. Keys are
 * content-addressed (sha256), so an existing object with the same key
 * already holds the same bytes and uploads are idempotent.
 */
export class SupabaseMediaStorage {
  public readonly provider = SUPABASE_STORAGE_PROVIDER;
  public readonly bucket: string;

  private readonly client: StorageClient;

  public constructor(options: SupabaseMediaStorageOptions) {
    this.client = options.client;
    this.bucket = options.bucket;
  }

  public async put(
    input: Readonly<{
      storageKey: string;
      mimeType: string;
      bytes: Uint8Array;
    }>,
  ): Promise<void> {
    if (!input.storageKey.trim() || input.storageKey.includes("..")) {
      throw new Error("Invalid media storage key.");
    }

    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(input.storageKey, input.bytes, {
        contentType: input.mimeType,
        cacheControl: "31536000",
        upsert: false,
      });

    if (error && !isAlreadyExists(error as { message?: string; statusCode?: string })) {
      throw new Error(`Supabase Storage upload failed: ${error.message}`);
    }
  }

  public async read(storageKey: string): Promise<Uint8Array | null> {
    const { data, error } = await this.client.storage.from(this.bucket).download(storageKey);

    if (error || !data) {
      return null;
    }

    return new Uint8Array(await data.arrayBuffer());
  }
}
