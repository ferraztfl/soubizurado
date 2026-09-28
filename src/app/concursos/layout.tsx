import type { ReactNode } from "react";

import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";

import { SiteFooter } from "../_components/site-footer";
import { SiteHeader } from "../_components/site-header";
import styles from "./concursos.module.css";

export default async function ContestsLayout({ children }: Readonly<{ children: ReactNode }>) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  return (
    <div className={styles.shell}>
      <SiteHeader signedIn={Boolean(data.user)} />
      <main className={styles.content}>{children}</main>
      <SiteFooter />
    </div>
  );
}
