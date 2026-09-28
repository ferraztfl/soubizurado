import Link from "next/link";

import {
  CONTEST_STATUSES,
  contestLogoUrl,
  formatContestDate,
  isContestStatus,
  organizationBadge,
  salaryLabel,
  vacanciesLabel,
} from "@/modules/contests/domain/contest";
import type { ContestCard as ContestCardData } from "@/modules/contests/infrastructure/contest-queries";

import styles from "../concursos.module.css";

export function ContestStatusChip({ status }: Readonly<{ status: string }>) {
  const open = status === "REGISTRATION_OPEN" || status === "NOTICE_PUBLISHED";
  const closed = status === "EXAM_DONE" || status === "FINISHED";
  return (
    <span className={open ? styles.chipOpen : closed ? styles.chipClosed : styles.chip}>
      {isContestStatus(status) ? CONTEST_STATUSES[status] : status}
    </span>
  );
}

/** Contest summary card: name on top, badge + vacancies + salary below (listing and home page). */
export function ContestCard({ contest }: Readonly<{ contest: ContestCardData }>) {
  const registrationEnd = contest.status === "REGISTRATION_OPEN" ? formatContestDate(contest.registrationEnd) : null;

  return (
    <Link href={`/concursos/${contest.slug}`} className={styles.card}>
      <strong className={styles.cardTitle}>{contest.name}</strong>
      <div className={styles.cardBody}>
        {contest.logoAssetId ? (
          <span className={styles.logoTile}>
            {/* eslint-disable-next-line @next/next/no-img-element -- media route (private bucket) */}
            <img src={contestLogoUrl(contest.logoAssetId)} alt={`Logo: ${contest.organizationName}`} loading="lazy" />
          </span>
        ) : (
          <span className={styles.badge} aria-hidden="true">
            {organizationBadge(contest.organizationName)}
            {contest.stateCode ? <small>{contest.stateCode}</small> : null}
          </span>
        )}
        <span className={styles.cardFacts}>
          <b>{vacanciesLabel(contest.vacancies, contest.hasReserveList)}</b>
          <span>{salaryLabel(contest.salaryMinCents, contest.salaryMaxCents)}</span>
          <ContestStatusChip status={contest.status} />
        </span>
      </div>
      {registrationEnd || contest.board ? (
        <span className={styles.cardFooter}>
          {contest.board ? `Banca ${contest.board.name}` : null}
          {contest.board && registrationEnd ? " · " : null}
          {registrationEnd ? `Inscrições até ${registrationEnd}` : null}
        </span>
      ) : null}
    </Link>
  );
}
