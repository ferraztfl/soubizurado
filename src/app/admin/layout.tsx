import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  requireAdminUser,
} from "@/modules/identity/application/require-admin-user";

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
      <aside className={styles.sidebar}>
        <div>
          <Link
            href="/admin"
            className={styles.brand}
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
            <section className={styles.navGroup}>
              <span className={styles.groupLabel}>
                Visão geral
              </span>

              <Link
                href="/admin"
                className={styles.navItem}
              >
                <span className={styles.navDot} />
                Dashboard
              </Link>
            </section>

            <section className={styles.navGroup}>
              <span className={styles.groupLabel}>
                Banco de questões
              </span>

              <Link
                href="/app/revisao-questoes"
                className={styles.navItem}
              >
                <span className={styles.navDot} />
                Revisão editorial
              </Link>

              <span className={styles.navItemDisabled}>
                <span className={styles.navDot} />
                Todas as questões
              </span>

              <span className={styles.navItemDisabled}>
                <span className={styles.navDot} />
                Nova questão
              </span>
            </section>

            <section className={styles.navGroup}>
              <span className={styles.groupLabel}>
                Operação
              </span>

              <span className={styles.navItemDisabled}>
                <span className={styles.navDot} />
                Importações
              </span>

              <span className={styles.navItemDisabled}>
                <span className={styles.navDot} />
                Taxonomia
              </span>

              <span className={styles.navItemDisabled}>
                <span className={styles.navDot} />
                Mídias
              </span>
            </section>

            <section className={styles.navGroup}>
              <span className={styles.groupLabel}>
                Sistema
              </span>

              <span className={styles.navItemDisabled}>
                <span className={styles.navDot} />
                Usuários
              </span>
            </section>
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
              <strong>Administrador</strong>
              <span>{admin.email}</span>
            </div>
          </div>

          <Link
            href="/app"
            className={styles.studentLink}
          >
            Voltar para área do aluno
          </Link>
        </div>
      </aside>

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
            <span />
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
