import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { ensureProfileForAuthUser } from "@/modules/identity/application/ensure-profile";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const redirectTo = request.nextUrl.clone();

  redirectTo.pathname = "/app";
  redirectTo.search = "";

  const supabase = await createSupabaseServerClient();

  let authenticationSucceeded = false;

  if (code) {
    const { error } =
      await supabase.auth.exchangeCodeForSession(code);

    authenticationSucceeded = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    authenticationSucceeded = !error;
  }

  if (!authenticationSucceeded) {
    redirectTo.pathname = "/login";
    redirectTo.searchParams.set(
      "error",
      "confirmation_failed",
    );

    return NextResponse.redirect(redirectTo);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirectTo.pathname = "/login";
    redirectTo.searchParams.set(
      "error",
      "confirmation_failed",
    );

    return NextResponse.redirect(redirectTo);
  }

  await ensureProfileForAuthUser({
    authUserId: user.id,
    displayName:
      typeof user.user_metadata.display_name === "string"
        ? user.user_metadata.display_name
        : null,
  });

  return NextResponse.redirect(redirectTo);
}