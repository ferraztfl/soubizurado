import type { ReactNode } from "react";

import {
  requireAdminUser,
} from "@/modules/identity/application/require-admin-user";

import { AdminShell } from "./admin-shell";

type AdminLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function AdminLayout({
  children,
}: AdminLayoutProps) {
  const admin = await requireAdminUser();

  return (
    <AdminShell email={admin.email}>
      {children}
    </AdminShell>
  );
}
