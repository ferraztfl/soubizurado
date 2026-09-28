import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/*
 * Server-only access to Supabase Auth accounts for the admin user pages
 * (list, invite, block, password reset). The database role cannot read
 * the auth schema, so this uses the Auth admin API with the SECRET key —
 * never import it from client components. Passwords are never set here:
 * invited users choose theirs through the e-mailed link.
 */

export type AuthUserSummary = Readonly<{
  email: string | null;
  emailConfirmed: boolean;
  lastSignInAt: Date | null;
  blocked: boolean;
}>;

/** "Blocked" = banned for ~100 years; "none" lifts it. */
const BLOCK_DURATION = "876000h";

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

function requireClient(): SupabaseClient {
  const client = getAuthAdminClient();

  if (!client) {
    throw new AuthAdminUnavailableError();
  }

  return client;
}

export class AuthAdminUnavailableError extends Error {
  public constructor() {
    super("Supabase Auth admin is not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY).");
  }
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

      const bannedUntil = (data.user as { banned_until?: string | null }).banned_until;

      result.set(id, {
        email: data.user.email ?? null,
        emailConfirmed: Boolean(data.user.email_confirmed_at),
        lastSignInAt: data.user.last_sign_in_at ? new Date(data.user.last_sign_in_at) : null,
        blocked: Boolean(bannedUntil && Date.parse(bannedUntil) > Date.now()),
      });
    }),
  );

  return result;
}

export type InviteResult =
  | Readonly<{ ok: true; authUserId: string }>
  | Readonly<{ ok: false; reason: "EXISTS" | "FAILED"; message: string }>;

/** Sends Supabase's invite e-mail; the link lands on `redirectTo` to set a password. */
export async function inviteAuthUser(
  input: Readonly<{ email: string; displayName: string; redirectTo: string }>,
): Promise<InviteResult> {
  const { data, error } = await requireClient().auth.admin.inviteUserByEmail(input.email, {
    redirectTo: input.redirectTo,
    data: { display_name: input.displayName },
  });

  if (error || !data.user) {
    const exists = error?.status === 422 || /already|registered|exists/i.test(error?.message ?? "");
    return { ok: false, reason: exists ? "EXISTS" : "FAILED", message: error?.message ?? "Convite não enviado." };
  }

  return { ok: true, authUserId: data.user.id };
}

export async function setAuthUserBlocked(authUserId: string, blocked: boolean): Promise<void> {
  const { error } = await requireClient().auth.admin.updateUserById(authUserId, {
    ban_duration: blocked ? BLOCK_DURATION : "none",
  });

  if (error) {
    throw new Error(`Supabase Auth: ${error.message}`);
  }
}

/** E-mails a password recovery link (lands on `redirectTo`). */
export async function sendPasswordRecovery(authUserId: string, redirectTo: string): Promise<string> {
  const client = requireClient();
  const { data, error } = await client.auth.admin.getUserById(authUserId);

  if (error || !data.user?.email) {
    throw new Error("Conta sem e-mail.");
  }

  const reset = await client.auth.resetPasswordForEmail(data.user.email, { redirectTo });

  if (reset.error) {
    throw new Error(`Supabase Auth: ${reset.error.message}`);
  }

  return data.user.email;
}
