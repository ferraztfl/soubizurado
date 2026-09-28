import { cache } from "react";

import { hasPremiumAccess } from "@/modules/study/infrastructure/queries/student-access";
import { findStudentProfileId } from "@/modules/study/infrastructure/queries/answered-question-status";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";

export type SiteViewer = Readonly<{ signedIn: boolean; premium: boolean }>;

/** Who is looking at a public page (once per request): drives the header CTA and the Premium bar. */
export const loadSiteViewer = cache(async (): Promise<SiteViewer> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { signedIn: false, premium: false };

  const profileId = await findStudentProfileId(user.id);
  return { signedIn: true, premium: profileId ? await hasPremiumAccess(profileId) : false };
});
