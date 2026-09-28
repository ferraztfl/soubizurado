import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/*
 * Server-only lookup of Supabase Auth accounts (e-mail, last sign-in) for
 * the admin user list. The database role cannot read the auth schema, so
 * this uses the Auth admin API with the SECRET key — never import it from
 * client components.
 */

export type AuthUserSummary = Readonly<{
  email: string | null;
  emailConfirmed: boolean;
  lastSignInAt: Date | null;
}>;

let cached: SupabaseClient | null = null;

function getAuthAdminClient(): SupabaseClient | null {
  if (typeof window !== "undefined") {
    throw new Error("The Supabase Auth admin client must never run in the browser.");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !secret) {
    return null;
  }

  cached ??= createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}

/** Accounts by auth user id (one page of the admin list, at most ~50). */
export async function loadAuthUsers(authUserIds: readonly string[]): Promise<Map<string, AuthUserSummary>> {
  const client = getAuthAdminClient();
  const result = new Map<string, AuthUserSummary>();

  if (!client) {
    return result;
  }

  await Promise.all(
    authUserIds.slice(0, 100).map(async (id) => {
      const { data, error } = await client.auth.admin.getUserById(id);

      if (error || !data.user) {
        return;
      }

      result.set(id, {
        email: data.user.email ?? null,
        emailConfirmed: Boolean(data.user.email_confirmed_at),
        lastSignInAt: data.user.last_sign_in_at ? new Date(data.user.last_sign_in_at) : null,
      });
    }),
  );

  return result;
}
