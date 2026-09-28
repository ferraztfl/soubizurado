import Link from "next/link";
import { redirect } from "next/navigation";

import {
  parseRankingPeriod,
  periodStartDay,
  RANKING_PERIODS,
  RANKING_SIZE,
  type RankingEntry,
} from "@/modules/study/domain/ranking";
import { findStudentProfileId } from "@/modules/study/infrastructure/queries/answered-question-status";
import { loadRanking } from "@/modules/study/infrastructure/queries/ranking";
import { loadStudyPreferences, todayInSaoPaulo } from "@/modules/study/infrastructure/queries/study-preferences";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";
import { EmptyState } from "@/shared/ui/empty-state";
import { PageHeader } from "@/shared/ui/page-header";

import styles from "./ranking.module.css";

export const dynamic = "force-dynamic";

type RankingPageProps = Readonly<{
  searchParams: Promise<Readonly<{ periodo?: string }>>;
}>;

const MEDALS = ["🥇", "🥈", "🥉"] as const;
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

function Row({ entry, isMe }: Readonly<{ entry: RankingEntry; isMe: boolean }>) {
  return (
    <li className={isMe ? styles.rowMe : styles.row}>
      <span className={styles.position}>{MEDALS[entry.position - 1] ?? `${entry.position}º`}</span>
      <span className={styles.name}>
        {entry.name}
        {isMe ? <small> (você)</small> : null}
      </span>
      <span className={styles.points}>
        <strong>{entry.points}</strong> acertos
      </span>
      <span className={styles.accuracy}>
        {entry.accuracy}% de {entry.answered}
      </span>
    </li>
  );
}

export default async function RankingPage(props: RankingPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const period = parseRankingPeriod((await props.searchParams).periodo);
  const startDay = periodStartDay(period, todayInSaoPaulo());
  const profileId = await findStudentProfileId(user.id);
  const [ranking, preferences] = await Promise.all([
    loadRanking(startDay, profileId),
    profileId ? loadStudyPreferences(profileId) : null,
  ]);
  const hidden = preferences ? !preferences.showInRanking : false;

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Evolução"
        title="Ranking"
        description="Quem mais acertou questões diferentes no período. Repetir a mesma questão não soma pontos; o desempate é pela taxa de acerto."
      />

      <nav className={styles.tabs} aria-label="Período">
        {(Object.keys(RANKING_PERIODS) as (keyof typeof RANKING_PERIODS)[]).map((key) => (
          <Link
            key={key}
            href={key === "semana" ? "/app/ranking" : `/app/ranking?periodo=${key}`}
            className={key === period ? styles.tabActive : styles.tab}
            aria-current={key === period ? "page" : undefined}
          >
            {RANKING_PERIODS[key]}
          </Link>
        ))}
        <span className={styles.since}>
          desde {dateFormatter.format(new Date(`${startDay}T00:00:00Z`))} · {ranking.participants}{" "}
          {ranking.participants === 1 ? "participante" : "participantes"}
        </span>
      </nav>

      {hidden ? (
        <p className={styles.notice}>
          Você está oculto do ranking. Para aparecer, ative a opção em{" "}
          <Link href="/app/configuracoes">Configurações</Link>.
        </p>
      ) : null}

      {ranking.top.length === 0 ? (
        <div className={styles.card}>
          <EmptyState
            icon="🏆"
            title="Ninguém pontuou ainda neste período"
            description="Resolva questões para abrir o ranking. Cada questão diferente que você acerta vale 1 ponto."
          />
        </div>
      ) : (
        <section className={styles.card} aria-label={`Top ${RANKING_SIZE}`}>
          <ol className={styles.list}>
            {ranking.top.map((entry) => (
              <Row key={entry.profileId} entry={entry} isMe={entry.profileId === profileId} />
            ))}
          </ol>
          {ranking.me ? (
            <>
              <p className={styles.gap}>…</p>
              <ol className={styles.list}>
                <Row entry={ranking.me} isMe />
              </ol>
            </>
          ) : null}
        </section>
      )}
    </div>
  );
}
