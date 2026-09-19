"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOutAction } from "@/modules/identity/presentation/actions/auth-actions";

import styles from "./student-sidebar.module.css";

type StudentSidebarProps = Readonly<{
  displayName: string;
  email?: string;
  firstName: string;
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
    label: "Estudos",
    items: [
      { label: "Início", href: "/app" },
      { label: "Explorar questões", href: null },
      { label: "Estudar", href: null },
      { label: "Revisar", href: null },
      { label: "Desempenho", href: null },
    ],
  },
  {
    label: "Evolução",
    items: [
      { label: "Simulados", href: null },
      { label: "Missões", href: null },
      { label: "Ranking", href: null },
    ],
  },
  {
    label: "Conta",
    items: [
      { label: "Comunidade", href: null },
      { label: "Loja", href: null },
      { label: "Perfil", href: null },
      { label: "Configurações", href: null },
    ],
  },
] as const;

export function StudentSidebar({
  displayName,
  email,
  firstName,
  onNavigate,
}: StudentSidebarProps) {
  const pathname = usePathname();

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
          {navigationGroups.map((group) => (
            <section
              key={group.label}
              className={styles.navigationGroup}
            >
              <span className={styles.groupLabel}>
                {group.label}
              </span>

              <div className={styles.groupItems}>
                {group.items.map((item) => {
                  if (!item.href) {
                    return (
                      <div
                        key={item.label}
                        className={`${styles.navItem} ${styles.disabled}`}
                        aria-disabled="true"
                        aria-label={`${item.label}, disponível em breve`}
                        title="Disponível em breve"
                      >
                        <span
                          className={styles.navMarker}
                          aria-hidden="true"
                        />
                        <span>{item.label}</span>
                      </div>
                    );
                  }

                  const active =
                    pathname === item.href;

                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={`${styles.navItem} ${
                        active ? styles.active : ""
                      }`}
                      aria-current={
                        active ? "page" : undefined
                      }
                      onClick={onNavigate}
                    >
                      <span
                        className={styles.navMarker}
                        aria-hidden="true"
                      />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
      </div>

      <div className={styles.bottom}>
        <section
          className={styles.planCard}
          aria-label="Plano atual"
        >
          <div className={styles.planHeading}>
            <span className={styles.planLabel}>
              Plano atual
            </span>
            <span className={styles.planBadge}>
              Grátis
            </span>
          </div>

          <strong>Plano gratuito</strong>

          <p>
            Recursos essenciais para começar sua preparação.
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
