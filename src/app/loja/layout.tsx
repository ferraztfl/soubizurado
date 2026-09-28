import type { ReactNode } from "react";

import { SiteShell } from "../_components/site-shell";
import styles from "./loja.module.css";

/** Public store: the same header, footer and Premium bar as the rest of the site. */
export default function StoreLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <SiteShell mainClassName={styles.main}>{children}</SiteShell>;
}
