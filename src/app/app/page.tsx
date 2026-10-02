import { findStudentProfileId } from "@/modules/study/infrastructure/queries/answered-question-status";
import {
  loadStudentPerformance,
  weakestTopics,
  type StudentPerformance,
} from "@/modules/study/infrastructure/queries/student-performance";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";
import { PageHeader } from "@/shared/ui/page-header";

import { AttentionCard } from "./_components/attention-card";
import { ContinueStudyingCard } from "./_components/continue-studying-card";
import { DashboardHero } from "./_components/dashboard-hero";
import { DashboardMetrics } from "./_components/dashboard-metrics";
import { GettingStartedCard } from "./_components/getting-started-card";
import { PerformanceCard } from "./_components/performance-card";

import styles from "./dashboard.module.css";

export const dynamic = "force-dynamic";

async function loadDashboard(): Promise<{ performance: StudentPerformance | null; favorites: number }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profileId = user ? await findStudentProfileId(user.id) : null;

  if (!profileId) {
    return { performance: null, favorites: 0 };
  }

  const [performance, favorites] = await Promise.all([
    loadStudentPerformance(profileId),
    getPrismaClient().studyFavorite.count({ where: { profileId } }),
  ]);

  return { performance, favorites };
}

export default async function StudentHomePage() {
  const { performance, favorites } = await loadDashboard();
  const totals = performance?.totals;
  const metrics = {
    attempts: totals?.attempts ?? 0,
    correct: totals?.correct ?? 0,
    streakDays: totals?.streakDays ?? 0,
    favorites,
  };

  return (
    <div className={styles.dashboard}>
      <PageHeader
        eyebrow="Visão geral"
        title="Seu painel de estudos"
        description="Acompanhe seu ritmo, retome sua preparação e veja o que merece atenção agora."
      />

      <DashboardHero attempts={metrics.attempts} today={totals?.today ?? 0} />

      <DashboardMetrics data={metrics} />

      <section className={styles.contentGrid}>
        <div className={styles.mainColumn}>
          <ContinueStudyingCard lastActivity={performance?.lastActivity ?? null} />
          <PerformanceCard attempts={metrics.attempts} days={performance?.days ?? []} />
        </div>

        <aside className={styles.rightRail}>
          <AttentionCard
            hasAnswers={metrics.attempts > 0}
            wrongQuestions={totals?.wrongQuestions ?? 0}
            weakestTopic={performance ? (weakestTopics(performance.topics, 1)[0] ?? null) : null}
            favorites={favorites}
          />
          <GettingStartedCard />
        </aside>
      </section>
    </div>
  );
}
