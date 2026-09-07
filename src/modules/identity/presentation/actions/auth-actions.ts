"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { ensureProfileForAuthUser } from "@/modules/identity/application/ensure-profile";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
});

const signUpSchema = loginSchema.extend({
  displayName: z.string().trim().min(2).max(120),
});

export async function signUpAction(formData: FormData) {
  const parsed = signUpSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect("/cadastro?error=invalid_input");
  }

  const supabase = await createSupabaseServerClient();

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,

    options: {
      emailRedirectTo: `${siteUrl}/auth/confirm`,
      data: {
        display_name: parsed.data.displayName,
      },
    },
  });

  if (error || !data.user) {
    redirect("/cadastro?error=signup_failed");
  }

  await ensureProfileForAuthUser({
    authUserId: data.user.id,
    displayName: parsed.data.displayName,
  });

  if (data.session) {
    redirect("/app");
  }

  redirect("/login?created=1");
}

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect("/login?error=invalid_input");
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    redirect("/login?error=invalid_credentials");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await ensureProfileForAuthUser({
      authUserId: user.id,
      displayName:
        typeof user.user_metadata.display_name === "string"
          ? user.user_metadata.display_name
          : null,
    });
  }

  redirect("/app");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();

  await supabase.auth.signOut();

  redirect("/login");
}