"use client";

import type { ReactNode } from "react";
import {
  useCallback,
  useState,
} from "react";

import { MobileNavigationDrawer } from "./mobile-navigation-drawer";
import { StudentSidebar } from "./student-sidebar";
import { StudentTopbar } from "./student-topbar";

import styles from "../app-shell.module.css";

type StudentAppShellProps = Readonly<{
  children: ReactNode;
  displayName: string;
  email?: string;
  firstName: string;
}>;

export function StudentAppShell({
  children,
  displayName,
  email,
  firstName,
}: StudentAppShellProps) {
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
        <StudentSidebar
          displayName={displayName}
          email={email}
          firstName={firstName}
        />
      </div>

      <div className={styles.workspace}>
        <StudentTopbar
          firstName={firstName}
          onMenuClick={openNavigation}
        />

        <main className={styles.content}>
          {children}
        </main>
      </div>

      <MobileNavigationDrawer
        open={navigationOpen}
        onClose={closeNavigation}
      >
        <StudentSidebar
          displayName={displayName}
          email={email}
          firstName={firstName}
          onNavigate={closeNavigation}
        />
      </MobileNavigationDrawer>
    </div>
  );
}
