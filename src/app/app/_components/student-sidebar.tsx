"use client";

import Image from "next/image";
import Link from "next/link";

import { signOutAction } from "@/modules/identity/presentation/actions/auth-actions";

import styles from "./student-sidebar.module.css";

type StudentSidebarProps = Readonly<{
  displayName: string;
  email?: string;
  firstName: string;
  onNavigate?: () => void;
}>;

const navigationItems = [
  {
    label: "Início",
    href: "/app",
    active: true,
  },
  {
    label: "Questões",
    href: "#",
    active: false,
  },
  {
    label: "Simulados",
    href: "#",
    active: false,
  },
  {
    label: "Desempenho",
    href: "#",
    active: false,
  },
  {
    label: "Favoritas",
    href: "#",
    active: false,
  },
] as const;

export function StudentSidebar({
  displayName,
  email,
  firstName,
  onNavigate,
}: StudentSidebarProps) {
  return (
    <div className={styles.sidebar}>
      <div>
        <Link
          href="/app"
          className={styles.brand}
          aria-label="Sou Bizurado Concursos"
          onClick={onNavigate}
        >
          <span className={styles.brandCard}>
            <Image
              src="/brand/logo-horizontal.png"
              alt="Sou Bizurado Concursos"
              width={900}
              height={420}
              priority
              className={styles.logo}
            />
          </span>
        </Link>

        <nav
          className={styles.navigation}
          aria-label="Navegação principal"
        >
          {navigationItems.map((item) => {
            if (item.active) {
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`${styles.navItem} ${styles.active}`}
                  aria-current="page"
                  onClick={onNavigate}
                >
                  <span className={styles.navDot} />
                  <span>{item.label}</span>
                </Link>
              );
            }

            return (
              <div
                key={item.label}
                className={`${styles.navItem} ${styles.disabled}`}
                aria-disabled="true"
              >
                <span className={styles.navDot} />
                <span>{item.label}</span>
                <small>Em breve</small>
              </div>
            );
          })}
        </nav>
      </div>

      <div className={styles.bottom}>
        <section
          className={styles.planCard}
          aria-label="Plano atual"
        >
          <span className={styles.planLabel}>
            Seu plano
          </span>

          <strong>Gratuito</strong>

          <p>
            Continue estudando e acompanhe sua evolução.
          </p>

          <span className={styles.planFooter}>
            Premium em breve
          </span>
        </section>

        <div className={styles.user}>
          <div
            className={styles.avatar}
            aria-hidden="true"
          >
            {firstName.charAt(0).toUpperCase()}
          </div>

          <div className={styles.userData}>
            <strong>{displayName}</strong>
            <span>{email}</span>
          </div>

          <form action={signOutAction}>
            <button
              type="submit"
              className={styles.logout}
              aria-label="Sair da conta"
            >
              Sair
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
