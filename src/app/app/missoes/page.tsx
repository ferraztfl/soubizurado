import Link from "next/link";
import { redirect } from "next/navigation";

import { buildMissions, type Mission } from "@/modules/study/domain/missions";
import { findStudentProfileId } from "@/modules/study/infrastructure/queries/answered-question-status";
import { loadMissionProgress } from "@/modules/study/infrastructure/queries/mission-progress";
import { DEFAULT_STUDY_PREFERENCES } from "@/modules/study/domain/study-preferences";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";
import { PageHeader } from "@/shared/ui/page-header";

import styles from "./missoes.module.css";

export const dynamic = "force-dynamic";

const EMPTY_PROGRESS = {
  weekStart: "",
  dailyGoal: DEFAULT_STUDY_PREFERENCES.dailyGoal,
  today: { attempts: 0, correct: 0 },
  dueReviews: 0,
  week: { attempts: 0, correct: 0, activeDays: 0, finishedSessions: 0, finishedSimulations: 0 },
};

function MissionCard({ mission }: Readonly<{ mission: Mission }>) {
  const percent = Math.round((mission.current / mission.target) * 100);

  return (
    <li className={mission.done ? styles.missionDone : styles.mission}>
      <span className={styles.icon} aria-hidden="true">
        {mission.done ? "✓" : mission.period === "daily" ? "☀" : "★"}
      </span>
      <div className={styles.body}>
        <strong>{mission.title}</strong>
        <span className={styles.description}>{mission.description}</span>
        <div
          className={styles.bar}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={mission.target}
          aria-valuenow={mission.current}
          aria-label={mission.title}
        >
          <div className={styles.fill} style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className={styles.side}>
        <span className={styles.count}>
          {mission.id === "daily-reviews" ? (mission.done ? "em dia" : "pendente") : `${mission.current}/${mission.target}${mission.id === "weekly-accuracy" ? "%" : ""}`}
        </span>
        {mission.done ? null : (
          <Link href={mission.href} className={styles.go}>
            Ir
          </Link>
        )}
      </div>
    </li>
  );
}

export default async function MissionsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profileId = await findStudentProfileId(user.id);
  const progress = profileId ? await loadMissionProgress(profileId) : EMPTY_PROGRESS;
  const missions = buildMissions(progress);
  const daily = missions.filter((mission) => mission.period === "daily");
  const weekly = missions.filter((mission) => mission.period === "weekly");
  const done = missions.filter((mission) => mission.done).length;

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Evolução"
        title="Missões"
        description="Metas curtas para manter o ritmo. As diárias renovam à meia-noite e as semanais toda segunda-feira (horário de Brasília)."
      />

      <section className={styles.summary} aria-label="Resumo">
        <strong>
          {done} de {missions.length}
        </strong>
        <span>missões concluídas</span>
      </section>

      <section className={styles.card}>
        <h2>Hoje</h2>
        <ul className={styles.list}>
          {daily.map((mission) => (
            <MissionCard key={mission.id} mission={mission} />
          ))}
        </ul>
      </section>

      <section className={styles.card}>
        <h2>Esta semana</h2>
        <ul className={styles.list}>
          {weekly.map((mission) => (
            <MissionCard key={mission.id} mission={mission} />
          ))}
        </ul>
      </section>
    </div>
  );
}
