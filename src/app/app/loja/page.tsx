import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { StoreListing } from "@/app/loja/_components/store-listing";
import { findStudentProfileId } from "@/modules/study/infrastructure/queries/answered-question-status";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Loja", robots: { index: false } };

/** The store inside the student area: same offers as /loja, minus what the student already has. */
export default async function StudentStorePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/app/loja");
  }

  return <StoreListing basePath="/app/loja" profileId={await findStudentProfileId(user.id)} />;
}
