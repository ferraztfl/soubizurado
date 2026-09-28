import type { ReactNode } from "react";

import { formatBRL } from "@/modules/store/domain/store";
import { DEFAULT_SUBSCRIPTION_PLAN, SUBSCRIPTION_PLANS, pricePerDayCents } from "@/modules/store/domain/subscription";

import { PremiumBar } from "./premium-bar";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import styles from "./site-shell.module.css";
import { loadSiteViewer } from "./site-viewer";

/** Public pages: one header, one footer and the Premium bar (hidden for subscribers). */
export async function SiteShell({ children, mainClassName }: Readonly<{ children: ReactNode; mainClassName?: string }>) {
  const viewer = await loadSiteViewer();

  return (
    <div className={viewer.premium ? styles.shell : styles.shellWithBar}>
      <SiteHeader signedIn={viewer.signedIn} premium={viewer.premium} />
      <main className={mainClassName ?? styles.main}>{children}</main>
      <SiteFooter />
      {viewer.premium ? null : (
        <PremiumBar
          price={formatBRL(SUBSCRIPTION_PLANS[DEFAULT_SUBSCRIPTION_PLAN].amountCents)}
          perDay={formatBRL(pricePerDayCents(DEFAULT_SUBSCRIPTION_PLAN))}
        />
      )}
    </div>
  );
}
