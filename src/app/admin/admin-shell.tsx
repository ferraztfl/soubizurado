"use client";

import type { ReactNode } from "react";
import {
  useCallback,
  useState,
} from "react";

import { MobileNavigationDrawer } from "@/app/app/_components/mobile-navigation-drawer";

import { AdminSidebar } from "./admin-sidebar";

import styles from "./layout.module.css";

const MOBILE_NAVIGATION_ID =
  "admin-mobile-navigation";

type AdminShellProps = Readonly<{
  children: ReactNode;
  email: string;
}>;

export function AdminShell({
  children,
  email,
}: AdminShellProps) {
  const [navigationOpen, setNavigationOpen] =
    useState(false);

  const openNavigation = useCallback(() => {
    setNavigationOpen(true);
  }, []);

  const closeNavigation = useCallback(() => {
    setNavigationOpen(false);
  }, []);

  return (
    <div className={styles.shell}>
      <div className={styles.desktopSidebar}>
        <AdminSidebar email={email} />
      </div>

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <button
            type="button"
            className={styles.menuButton}
            aria-label="Abrir menu administrativo"
            aria-controls={MOBILE_NAVIGATION_ID}
            aria-expanded={navigationOpen}
            onClick={openNavigation}
          >
            <span />
            <span />
            <span />
          </button>

          <div className={styles.topbarTitle}>
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

      <MobileNavigationDrawer
        id={MOBILE_NAVIGATION_ID}
        label="Menu administrativo"
        open={navigationOpen}
        onClose={closeNavigation}
      >
        <AdminSidebar
          email={email}
          onNavigate={closeNavigation}
        />
      </MobileNavigationDrawer>
    </div>
  );
}
