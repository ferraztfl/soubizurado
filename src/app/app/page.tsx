import { PageHeader } from "@/shared/ui/page-header";

import { AttentionCard } from "./_components/attention-card";
import { ContinueStudyingCard } from "./_components/continue-studying-card";
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

      <section className={styles.contentGrid}>
        <div className={styles.mainColumn}>
          <ContinueStudyingCard />
          <PerformanceCard />
        </div>

        <aside className={styles.rightRail}>
          <AttentionCard />
          <GettingStartedCard />
        </aside>
      </section>
    </div>
  );
}
