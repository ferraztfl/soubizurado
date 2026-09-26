import { getPrismaClient } from "@/shared/infrastructure/database/prisma";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";

/**
 * Read-only check used where a redirect is not appropriate (e.g. media
 * responses). Authorization comes only from the persisted ADMIN role;
 * it never bootstraps an admin (requireAdminUser does that on admin
 * pages) and never trusts user_metadata.
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return false;
  }

  const role = await getPrismaClient().userRole.findFirst({
    where: {
      role: "ADMIN",
      profile: { authUserId: user.id },
    },
    select: { id: true },
  });

  return Boolean(role);
}
