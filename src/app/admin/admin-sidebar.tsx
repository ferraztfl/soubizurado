"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./layout.module.css";

type AdminSidebarProps = Readonly<{
  email: string;
  onNavigate?: () => void;
}>;

type NavigationItem = Readonly<{
  label: string;
  href: string | null;
}>;

type NavigationGroup = Readonly<{
  label: string;
  items: readonly NavigationItem[];
}>;

const navigationGroups: readonly NavigationGroup[] = [
  {
    label: "Visão geral",
    items: [
      {
        label: "Dashboard",
        href: "/admin",
      },
    ],
  },
  {
    label: "Banco de questões",
    items: [
      {
        label: "Revisão editorial",
        href: "/admin/questoes/revisao",
      },
      {
        label: "Todas as questões",
        href: null,
      },
      {
        label: "Nova questão",
        href: null,
      },
    ],
  },
  {
    label: "Operação",
    items: [
      {
        label: "Importações",
        href: null,
      },
      {
        label: "Taxonomia",
        href: null,
      },
      {
        label: "Mídias",
        href: null,
      },
    ],
  },
  {
    label: "Sistema",
    items: [
      {
        label: "Usuários",
        href: null,
      },
    ],
  },
] as const;

function isActivePath(
  pathname: string,
  href: string,
): boolean {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  return (
    pathname === href ||
    pathname.startsWith(`${href}/`)
  );
}

export function AdminSidebar({
  email,
  onNavigate,
}: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div>
        <Link
          href="/admin"
          className={styles.brand}
          onClick={onNavigate}
          aria-label="Sou Bizurado Backoffice"
        >
          <Image
            src="/brand/logo-horizontal.png"
            alt="Sou Bizurado"
            width={900}
            height={420}
            priority
            className={styles.logo}
          />

          <span className={styles.adminBadge}>
            Backoffice
          </span>
        </Link>

        <nav
          className={styles.navigation}
          aria-label="Administração"
        >
          {navigationGroups.map((group) => (
            <section
              key={group.label}
              className={styles.navGroup}
            >
              <span className={styles.groupLabel}>
                {group.label}
              </span>

              {group.items.map((item) => {
                if (!item.href) {
                  return (
                    <span
                      key={item.label}
                      className={styles.navItemDisabled}
                    >
                      <span
                        className={styles.navDot}
                        aria-hidden="true"
                      />

                      {item.label}
                    </span>
                  );
                }

                const active =
                  isActivePath(
                    pathname,
                    item.href,
                  );

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={onNavigate}
                    className={`${styles.navItem} ${
                      active
                        ? styles.navItemActive
                        : ""
                    }`}
                    aria-current={
                      active
                        ? "page"
                        : undefined
                    }
                  >
                    <span
                      className={styles.navDot}
                      aria-hidden="true"
                    />

                    {item.label}
                  </Link>
                );
              })}
            </section>
          ))}
        </nav>
      </div>

      <div className={styles.sidebarBottom}>
        <div className={styles.adminProfile}>
          <div
            className={styles.avatar}
            aria-hidden="true"
          >
            A
          </div>

          <div className={styles.adminData}>
            <strong>
              Administrador
            </strong>

            <span>
              {email}
            </span>
          </div>
        </div>

        <Link
          href="/app"
          className={styles.studentLink}
          onClick={onNavigate}
        >
          Voltar para área do aluno
        </Link>
      </div>
    </aside>
  );
}
