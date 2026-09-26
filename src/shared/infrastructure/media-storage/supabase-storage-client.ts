import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

/*
 * Server-only Supabase client for Storage, authenticated with the
 * project's SECRET key (sb_secret_..., successor of service_role).
 * Never import this from client components; the key must stay in the
 * server environment (.env / hosting env vars), never NEXT_PUBLIC_*.
 */

let cached: SupabaseClient | null = null;

export function isSupabaseStorageConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
  );
}

export function mediaBucketName(): string {
  return process.env.SUPABASE_MEDIA_BUCKET?.trim() || "question-media";
}

export function getSupabaseStorageClient(): SupabaseClient {
  if (cached) {
    return cached;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !secret) {
    throw new Error(
      "Supabase Storage is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (server only).",
    );
  }

  if (typeof window !== "undefined") {
    throw new Error("The Supabase Storage client must never run in the browser.");
  }

  cached = createClient(url, secret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cached;
}
