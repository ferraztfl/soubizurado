import Link from "next/link";
import { redirect } from "next/navigation";

import { ensureProfileForAuthUser } from "@/modules/identity/application/ensure-profile";
import { DAILY_GOAL_OPTIONS, daysUntil } from "@/modules/study/domain/study-preferences";
import { saveProfileAction } from "@/modules/study/presentation/actions/account-actions";
import { loadStudentPerformance } from "@/modules/study/infrastructure/queries/student-performance";
import { loadStudyPreferences, todayInSaoPaulo } from "@/modules/study/infrastructure/queries/study-preferences";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";
import { PageHeader } from "@/shared/ui/page-header";

import styles from "./account.module.css";

export const dynamic = "force-dynamic";

type ProfilePageProps = Readonly<{
  searchParams: Promise<Readonly<{ ok?: string; error?: string }>>;
}>;

const ERRORS: Readonly<Record<string, string>> = {
  nome: "Informe um nome com 2 a 120 caracteres.",
  meta: "Escolha uma meta diária entre 1 e 500 questões.",
  data: "A data da prova precisa ser hoje ou uma data futura (até 5 anos).",
  concurso: "O nome do concurso pode ter até 180 caracteres.",
};

const numberFormatter = new Intl.NumberFormat("pt-BR");
const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" });

export default async function ProfilePage(props: ProfilePageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = await props.searchParams;
  const metadataName = typeof user.user_metadata.display_name === "string" ? user.user_metadata.display_name : null;
  const profile = await ensureProfileForAuthUser({ authUserId: user.id, displayName: metadataName });
  const prisma = getPrismaClient();
  const today = todayInSaoPaulo();

  const [preferences, performance, simulations, boards] = await Promise.all([
    loadStudyPreferences(profile.id),
    loadStudentPerformance(profile.id),
    prisma.studySimulation.count({ where: { profileId: profile.id, status: "FINISHED" } }),
    prisma.examiningBoard.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const name = profile.displayName ?? metadataName ?? user.email ?? "Aluno";
  const { totals } = performance;
  const accuracy = totals.attempts === 0 ? null : Math.round((totals.correct / totals.attempts) * 100);
  const goalProgress = Math.min(100, Math.round((totals.today / preferences.dailyGoal) * 100));
  const daysLeft = preferences.targetExamDate ? daysUntil(preferences.targetExamDate, today) : null;
  const targetBoard = boards.find((board) => board.id === preferences.targetBoardId)?.name ?? null;

  return (
    <div className={styles.page}>
      <PageHeader eyebrow="Conta" title="Perfil" description="Seus dados, seu objetivo e sua meta de estudo." />

      {params.ok ? (
        <div className={styles.noticeSuccess} role="status">
          Perfil atualizado.
        </div>
      ) : null}
      {params.error && ERRORS[params.error] ? (
        <div className={styles.noticeError} role="alert">
          {ERRORS[params.error]}
        </div>
      ) : null}

      <section className={styles.card}>
        <div className={styles.identity}>
          <span className={styles.avatar} aria-hidden="true">
            {name.trim().charAt(0).toUpperCase()}
          </span>
          <div>
            <strong>{name}</strong>
            <span>{user.email}</span>
            <br />
            <span>Estudando desde {monthFormatter.format(profile.createdAt)}</span>
          </div>
        </div>

        <div className={styles.kpis}>
          <div className={styles.kpi}>
            <span>Questões resolvidas</span>
            <strong>{numberFormatter.format(totals.distinctQuestions)}</strong>
          </div>
          <div className={styles.kpi}>
            <span>Taxa de acerto</span>
            <strong>{accuracy === null ? "—" : `${accuracy}%`}</strong>
          </div>
          <div className={styles.kpi}>
            <span>Sequência</span>
            <strong>
              {totals.streakDays} {totals.streakDays === 1 ? "dia" : "dias"}
            </strong>
          </div>
          <div className={styles.kpi}>
            <span>Simulados concluídos</span>
            <strong>{numberFormatter.format(simulations)}</strong>
          </div>
        </div>
      </section>

      <section className={styles.card} aria-label="Meta de hoje">
        <div className={styles.cardHead}>
          <h2>Meta de hoje</h2>
          <p>
            {totals.today >= preferences.dailyGoal
              ? `Meta batida: ${totals.today} de ${preferences.dailyGoal} questões. 🎯`
              : `${totals.today} de ${preferences.dailyGoal} questões respondidas hoje.`}
          </p>
        </div>
        <div className={styles.goal}>
          <div
            className={styles.goalBar}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={goalProgress}
            aria-label="Progresso da meta diária"
          >
            <div className={styles.goalFill} style={{ width: `${goalProgress}%` }} />
          </div>
        </div>
        {preferences.targetExam || daysLeft !== null ? (
          <p className={styles.countdown}>
            {preferences.targetExam ? `Objetivo: ${preferences.targetExam}` : "Sua prova"}
            {targetBoard ? ` · ${targetBoard}` : ""}
            {daysLeft !== null && preferences.targetExamDate
              ? ` · ${daysLeft === 0 ? "é hoje!" : `faltam ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"} (${dateFormatter.format(new Date(`${preferences.targetExamDate}T00:00:00Z`))})`}`
              : ""}
          </p>
        ) : null}
        <Link href="/app/questoes?situacao=nao-resolvidas" className={styles.linkButton}>
          Resolver questões novas
        </Link>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2>Dados e objetivo</h2>
          <p>O concurso-alvo e a data da prova aparecem na contagem regressiva; a meta diária alimenta as missões.</p>
        </div>

        <form action={saveProfileAction} className={styles.form}>
          <label className={`${styles.field} ${styles.full}`}>
            <span>Nome de exibição</span>
            <input name="displayName" defaultValue={name} required minLength={2} maxLength={120} autoComplete="name" />
          </label>
          <label className={styles.field}>
            <span>Concurso-alvo</span>
            <input name="targetExam" defaultValue={preferences.targetExam ?? ""} maxLength={180} placeholder="Ex.: PM PR — Soldado" />
          </label>
          <label className={styles.field}>
            <span>Banca-alvo</span>
            <select name="targetBoardId" defaultValue={preferences.targetBoardId ?? ""}>
              <option value="">Ainda não sei</option>
              {boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Data da prova</span>
            <input name="targetExamDate" type="date" min={today} defaultValue={preferences.targetExamDate ?? ""} />
          </label>
          <label className={styles.field}>
            <span>Meta diária (questões)</span>
            <select name="dailyGoal" defaultValue={String(preferences.dailyGoal)}>
              {[...new Set([...DAILY_GOAL_OPTIONS, preferences.dailyGoal])]
                .sort((a, b) => a - b)
                .map((goal) => (
                  <option key={goal} value={goal}>
                    {goal} por dia
                  </option>
                ))}
            </select>
          </label>
          <div className={styles.actions}>
            <button type="submit" className={styles.primary}>
              Salvar perfil
            </button>
            <Link href="/app/configuracoes" className={styles.linkButton}>
              Configurações
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
