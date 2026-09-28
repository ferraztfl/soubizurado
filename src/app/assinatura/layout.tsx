import type { ReactNode } from "react";

import { SiteShell } from "../_components/site-shell";
import styles from "./assinatura.module.css";

export default function SubscriptionLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <SiteShell mainClassName={styles.main}>{children}</SiteShell>;
}
