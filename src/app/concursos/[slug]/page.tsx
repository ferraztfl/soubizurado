import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { BRAZIL_STATES, parseStateCode } from "@/modules/blog/domain/blog";
import {
  EDUCATION_LEVELS,
  formatContestDate,
  organizationBadge,
  salaryLabel,
  vacanciesLabel,
  type EducationLevel,
} from "@/modules/contests/domain/contest";
import { loadPublishedContest } from "@/modules/contests/infrastructure/contest-queries";
import { siteUrl } from "@/modules/question-bank/infrastructure/queries/question-sitemap";
import { formatBRL } from "@/modules/store/domain/store";

import { ArticleBody } from "../../blog/article-body";
import { GridCard } from "../../blog/_components/post-cards";
import { ContestCard, ContestStatusChip } from "../_components/contest-card";
import styles from "../concursos.module.css";

export const dynamic = "force-dynamic";

type ContestPageProps = Readonly<{ params: Promise<{ slug: string }> }>;

const NO_IMAGES: ReadonlyMap<number, string> = new Map();
const updatedFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });

const loadContest = cache((slug: string) => (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) ? loadPublishedContest(slug, new Date()) : null));

function describe(contest: NonNullable<Awaited<ReturnType<typeof loadPublishedContest>>>): string {
  const parts = [
    vacanciesLabel(contest.vacancies, contest.hasReserveList),
    salaryLabel(contest.salaryMinCents, contest.salaryMaxCents).replace(/ /g, " "),
    contest.board ? `banca ${contest.board.name}` : "banca a definir",
  ];
  return `${contest.name}: ${parts.join(", ")}. Situação, datas, edital oficial e questões para treinar.`.slice(0, 300);
}

export async function generateMetadata({ params }: ContestPageProps): Promise<Metadata> {
  const contest = await loadContest((await params).slug);

  if (!contest) {
    return { title: "Concurso não encontrado", robots: { index: false } };
  }

  return {
    title: contest.name,
    description: describe(contest),
    alternates: { canonical: `/concursos/${contest.slug}` },
    openGraph: { type: "website", title: contest.name, description: describe(contest), url: `/concursos/${contest.slug}`, siteName: "Sou Bizurado", locale: "pt_BR" },
  };
}

export default async function ContestPage({ params }: ContestPageProps) {
  const contest = await loadContest((await params).slug);

  if (!contest) {
    notFound();
  }

  const now = new Date();
  const base = siteUrl();
  const state = parseStateCode(contest.stateCode);
  const offer = contest.relatedOffer?.isActive ? contest.relatedOffer : null;
  const registrationStart = formatContestDate(contest.registrationStart);
  const registrationEnd = formatContestDate(contest.registrationEnd);
  const registration =
    registrationStart && registrationEnd
      ? `${registrationStart} a ${registrationEnd}`
      : registrationEnd
        ? `até ${registrationEnd}`
        : registrationStart
          ? `a partir de ${registrationStart}`
          : "A definir";
  const education = contest.educationLevels
    .filter((level): level is EducationLevel => Object.hasOwn(EDUCATION_LEVELS, level))
    .map((level) => EDUCATION_LEVELS[level])
    .join(", ");

  const facts = [
    { label: "Vagas", value: vacanciesLabel(contest.vacancies, contest.hasReserveList) },
    { label: "Salário", value: salaryLabel(contest.salaryMinCents, contest.salaryMaxCents) },
    { label: "Banca", value: contest.board?.name ?? "A definir" },
    { label: "Escolaridade", value: education || "A definir" },
    { label: "Inscrições", value: registration },
    { label: "Prova", value: formatContestDate(contest.examDate) ?? "A definir" },
    { label: "Local", value: state ? BRAZIL_STATES[state] : "Nacional" },
  ];

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Concursos", item: `${base}/concursos` },
      { "@type": "ListItem", position: 2, name: contest.name, item: `${base}/concursos/${contest.slug}` },
    ],
  }).replace(/</g, "\\u003c");

  return (
    <article className={styles.detail}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      <nav className={styles.breadcrumb} aria-label="Você está em">
        <Link href="/concursos">Concursos</Link>
        {contest.careerCategory ? (
          <>
            <span aria-hidden="true">›</span>
            <Link href={`/concursos?carreira=${contest.careerCategory.slug}`}>{contest.careerCategory.name}</Link>
          </>
        ) : null}
        {state ? (
          <>
            <span aria-hidden="true">›</span>
            <Link href={`/concursos?uf=${state.toLowerCase()}`}>{state}</Link>
          </>
        ) : null}
      </nav>

      <header className={styles.detailHeader}>
        <span className={styles.badgeLarge} aria-hidden="true">
          {organizationBadge(contest.organizationName)}
        </span>
        <div>
          <ContestStatusChip status={contest.status} />
          <h1>{contest.name}</h1>
          <p>{contest.organizationName}</p>
        </div>
      </header>

      <dl className={styles.facts}>
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>

      <div className={styles.actions}>
        {contest.board ? (
          <Link href={`/questoes?board=${contest.board.id}`} className={styles.actionPrimary}>
            Resolver questões da banca {contest.board.name}
          </Link>
        ) : (
          <Link href="/questoes" className={styles.actionPrimary}>
            Resolver questões grátis
          </Link>
        )}
        {contest.organization ? (
          <Link href={`/questoes?org=${contest.organization.id}`} className={styles.actionSecondary}>
            Provas anteriores do órgão
          </Link>
        ) : null}
        {contest.noticeUrl ? (
          <a href={contest.noticeUrl} target="_blank" rel="noopener noreferrer nofollow" className={styles.actionSecondary}>
            Edital oficial ↗
          </a>
        ) : null}
      </div>

      {offer ? (
        <aside className={styles.offer} aria-label="Combo para este concurso">
          <div>
            <strong>{offer.name}</strong>
            <span>Questões ilimitadas e material para este concurso.</span>
          </div>
          <div className={styles.offerPrice}>
            {offer.compareAtCents ? <s>{formatBRL(offer.compareAtCents)}</s> : null}
            <b>{formatBRL(offer.priceCents)}</b>
          </div>
          <Link href={`/loja/${offer.slug}`}>Quero este combo</Link>
        </aside>
      ) : null}

      {contest.positions ? (
        <section className={styles.block}>
          <h2>Cargos</h2>
          <p className={styles.positions}>{contest.positions}</p>
        </section>
      ) : null}

      {contest.summary ? (
        <section className={styles.block}>
          <h2>Sobre o concurso</h2>
          <ArticleBody body={contest.summary} images={NO_IMAGES} />
        </section>
      ) : null}

      <p className={styles.disclaimer}>
        Informações conferidas no edital e em publicações oficiais; atualizado em {updatedFormat.format(contest.updatedAt)}. Confirme
        sempre no edital oficial.
      </p>

      {contest.posts.length > 0 ? (
        <section className={styles.block}>
          <h2>Notícias deste concurso</h2>
          <div className={styles.newsGrid}>
            {contest.posts.map((post) => (
              <GridCard key={post.slug} post={post} now={now} />
            ))}
          </div>
        </section>
      ) : null}

      {contest.related.length > 0 ? (
        <section className={styles.block}>
          <h2>Concursos relacionados</h2>
          <div className={styles.grid}>
            {contest.related.map((item) => (
              <ContestCard key={item.slug} contest={item} />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
