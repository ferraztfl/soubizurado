import type { ReactNode } from "react";

import { SiteShell } from "../_components/site-shell";
import styles from "./concursos.module.css";

export default function ContestsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <SiteShell mainClassName={styles.content}>{children}</SiteShell>;
}
