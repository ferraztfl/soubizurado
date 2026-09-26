"use client";

import type { ReactNode } from "react";
import {
  useEffect,
  useRef,
} from "react";
import { createPortal } from "react-dom";

import styles from "./mobile-navigation-drawer.module.css";

type MobileNavigationDrawerProps = Readonly<{
  children: ReactNode;
  open: boolean;
  onClose: () => void;
  id?: string;
  label?: string;
}>;

export function MobileNavigationDrawer({
  children,
  open,
  onClose,
  id = "student-mobile-navigation",
  label = "Menu principal",
}: MobileNavigationDrawerProps) {
  const closeButtonRef =
    useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    const previouslyFocusedElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    document.body.style.overflow = "hidden";

    closeButtonRef.current?.focus();

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );

      previouslyFocusedElement?.focus();
    };
  }, [open, onClose]);

  if (
    !open ||
    typeof document === "undefined"
  ) {
    return null;
  }

  return createPortal(
    <div className={styles.layer}>
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Fechar menu"
        onClick={onClose}
      />

      <aside
        id={id}
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        <header className={styles.drawerHeader}>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            aria-label="Fechar menu principal"
            onClick={onClose}
          >
            <span
              className={styles.closeIcon}
              aria-hidden="true"
            >
              <span />
              <span />
            </span>
          </button>

          <div className={styles.headerText}>
            <span>
              MENU
            </span>
          </div>
        </header>

        <div className={styles.drawerContent}>
          {children}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
