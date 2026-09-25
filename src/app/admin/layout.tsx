import type { ReactNode } from "react";

import {
  requireAdminUser,
} from "@/modules/identity/application/require-admin-user";

import { AdminSidebar } from "./admin-sidebar";

import styles from "./layout.module.css";

type AdminLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function AdminLayout({
  children,
}: AdminLayoutProps) {
  const admin = await requireAdminUser();

  return (
    <div className={styles.shell}>
      <AdminSidebar email={admin.email} />

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div>
            <span className={styles.topbarEyebrow}>
              Administração
            </span>

            <strong>
              Central de operações
            </strong>
          </div>

          <div className={styles.secureBadge}>
            <span aria-hidden="true" />
            Ambiente protegido
          </div>
        </header>

        <div className={styles.content}>
          {children}
        </div>
      </div>
    </div>
  );
}
