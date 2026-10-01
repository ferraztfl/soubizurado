"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOutAction } from "@/modules/identity/presentation/actions/auth-actions";

import { NavIcon } from "./nav-icons";
import { planUsageText, type StudentPlan } from "./student-plan";
import styles from "./student-sidebar.module.css";

type StudentSidebarProps = Readonly<{
  displayName: string;
  email?: string;
  firstName: string;
  plan: StudentPlan;
  onNavigate?: () => void;
  /** Desktop only: icons-only mode and its toggle (the mobile drawer never passes them). */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
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
      { label: "Explorar questões", href: "/app/questoes" },
      { label: "Estudar", href: "/app/estudar" },
      { label: "Meus cursos", href: "/app/cursos" },
      { label: "Desempenho", href: "/app/desempenho" },
    ],
  },
  {
    label: "Evolução",
    items: [
      { label: "Simulados", href: "/app/simulados" },
      { label: "Missões", href: "/app/missoes" },
      { label: "Ranking", href: "/app/ranking" },
    ],
  },
  {
    label: "Conta",
    items: [
      { label: "Comunidade", href: null },
      { label: "Assinatura", href: "/app/assinatura" },
      { label: "Loja", href: "/loja" },
      { label: "Minhas compras", href: "/app/compras" },
      { label: "Perfil", href: "/app/perfil" },
      { label: "Configurações", href: "/app/configuracoes" },
    ],
  },
] as const;

export function StudentSidebar({
  displayName,
  email,
  firstName,
  plan,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: StudentSidebarProps) {
  const pathname = usePathname();

  return (
    <div className={styles.sidebar} data-collapsed={collapsed ? "true" : undefined}>
      <div>
        {onToggleCollapse ? (
          <button
            type="button"
            className={styles.collapseButton}
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expandir o menu" : "Recolher o menu"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expandir o menu" : "Recolher o menu"}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
              <path d="M9 4.5v15" />
              <path d={collapsed ? "m13 10 2 2-2 2" : "m15 10-2 2 2 2"} />
            </svg>
          </button>
        ) : null}

        <Link
          href="/app"
          className={styles.brand}
          aria-label="Sou Bizurado Concursos"
          onClick={onNavigate}
        >
          <span className={styles.brandCard}>
            <Image
              src={collapsed ? "/brand/logo-mark.png" : "/brand/logo-horizontal.png"}
              alt="Sou Bizurado Concursos"
              width={collapsed ? 500 : 900}
              height={collapsed ? 500 : 420}
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
              <span className={styles.groupLabel} aria-hidden={collapsed ? "true" : undefined}>
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
                        <span className={styles.navIcon}>
                          <NavIcon label={item.label} />
                        </span>
                        <span className={styles.navText}>{item.label}</span>
                      </div>
                    );
                  }

                  const active =
                    pathname === item.href ||
                    (
                      item.href !== "/app" &&
                      pathname.startsWith(
                        `${item.href}/`,
                      )
                    );

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
                      title={collapsed ? item.label : undefined}
                    >
                      <span className={styles.navIcon}>
                        <NavIcon label={item.label} />
                      </span>
                      <span className={styles.navText}>{item.label}</span>
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
              {plan.premium ? "Premium" : plan.visitor ? "Visitante" : "Grátis"}
            </span>
          </div>

          <strong>{plan.premium ? "Plano Premium" : plan.visitor ? "Sem conta" : "Plano gratuito"}</strong>

          <p>
            {planUsageText(plan)}
          </p>

          <span className={styles.planFooter}>
            {plan.premium ? "Obrigado por apoiar o SouBizurado" : "Conheça o Premium na Loja"}
          </span>
        </section>

        {plan.visitor ? (
          <div className={styles.visitorActions}>
            <Link href="/cadastro" className={styles.visitorPrimary} onClick={onNavigate}>
              Criar conta grátis
            </Link>
            <Link href="/login" className={styles.visitorSecondary} onClick={onNavigate}>
              Entrar
            </Link>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
