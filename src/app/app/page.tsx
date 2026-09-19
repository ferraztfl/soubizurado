import { PageHeader } from "@/shared/ui/page-header";

import { DashboardHero } from "./_components/dashboard-hero";
import { DashboardMetrics } from "./_components/dashboard-metrics";
import { GettingStartedCard } from "./_components/getting-started-card";
import { PerformanceCard } from "./_components/performance-card";

import styles from "./dashboard.module.css";

export default function StudentHomePage() {
  return (
    <div className={styles.dashboard}>
      <PageHeader
        eyebrow="Visão geral"
        title="Seu painel de estudos"
        description="Acompanhe seu ritmo, retome sua preparação e veja o que merece atenção agora."
      />

      <DashboardHero />

      <DashboardMetrics />

      <section className={styles.lowerGrid}>
        <PerformanceCard />
        <GettingStartedCard />
      </section>
    </div>
  );
}
