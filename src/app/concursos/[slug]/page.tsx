import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { BRAZIL_STATES, parseStateCode } from "@/modules/blog/domain/blog";
import {
  asEducationLevel,
  contestFaq,
  contestLogoUrl,
  contestTimeline,
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
import { DEFAULT_SUBSCRIPTION_PLAN, SUBSCRIPTION_PLANS } from "@/modules/store/domain/subscription";

import { ArticleBody } from "../../blog/article-body";
import { GridCard } from "../../blog/_components/post-cards";
import { ShareButtons } from "../../blog/_components/share-buttons";
import { ContestCard, ContestStatusChip } from "../_components/contest-card";
import styles from "./contest-page.module.css";

export const dynamic = "force-dynamic";

type ContestPageProps = Readonly<{ params: Promise<{ slug: string }> }>;

const NO_IMAGES: ReadonlyMap<number, string> = new Map();
const updatedFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" });
const numberFormat = new Intl.NumberFormat("pt-BR");

const loadContest = cache((slug: string) => (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) ? loadPublishedContest(slug, new Date()) : null));

type LoadedContest = NonNullable<Awaited<ReturnType<typeof loadPublishedContest>>>;

function describe(contest: LoadedContest): string {
  const parts = [
    vacanciesLabel(contest.vacancies, contest.hasReserveList),
    salaryLabel(contest.salaryMinCents, contest.salaryMaxCents).replace(/ /g, " "),
    contest.board ? `banca ${contest.board.name}` : "banca a definir",
  ];
  return `${contest.name}: ${parts.join(", ")}. Cargos, cronograma, etapas, edital oficial e questões para treinar.`.slice(0, 300);
}

export async function generateMetadata({ params }: ContestPageProps): Promise<Metadata> {
  const contest = await loadContest((await params).slug);

  if (!contest) {
    return { title: "Concurso não encontrado", robots: { index: false } };
  }

  return {
    title: `${contest.name}: vagas, salário, edital e cronograma`,
    description: describe(contest),
    alternates: { canonical: `/concursos/${contest.slug}` },
    openGraph: {
      type: "website",
      title: contest.name,
      description: describe(contest),
      url: `/concursos/${contest.slug}`,
      siteName: "Sou Bizurado",
      locale: "pt_BR",
      ...(contest.logoAssetId ? { images: [{ url: contestLogoUrl(contest.logoAssetId) }] } : {}),
    },
  };
}

function educationLabel(levels: readonly string[]): string | null {
  const labels = levels
    .filter((level): level is EducationLevel => Object.hasOwn(EDUCATION_LEVELS, level))
    .map((level) => EDUCATION_LEVELS[level]);
  return labels.length > 0 ? labels.join(" e ") : null;
}

export default async function ContestPage({ params }: ContestPageProps) {
  const contest = await loadContest((await params).slug);

  if (!contest) {
    notFound();
  }

  const now = new Date();
  const base = siteUrl();
  const url = `${base}/concursos/${contest.slug}`;
  const state = parseStateCode(contest.stateCode);
  const offer = contest.relatedOffer?.isActive ? contest.relatedOffer : null;
  const positions = contest.contestPositions.map((position) => ({ ...position, educationLevel: asEducationLevel(position.educationLevel) }));
  const stages = contest.stages
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const timeline = contestTimeline(contest);
  const education =
    educationLabel(contest.educationLevels) ??
    educationLabel([...new Set(positions.map((position) => position.educationLevel).filter((level): level is EducationLevel => level !== null))]);
  const registration =
    contest.registrationStart && contest.registrationEnd
      ? `${formatContestDate(contest.registrationStart)} a ${formatContestDate(contest.registrationEnd)}`
      : contest.registrationEnd
        ? `Até ${formatContestDate(contest.registrationEnd)}`
        : "A definir";
  const faq = contestFaq({
    name: contest.name,
    status: contest.status,
    vacancies: contest.vacancies,
    hasReserveList: contest.hasReserveList,
    salaryMinCents: contest.salaryMinCents,
    salaryMaxCents: contest.salaryMaxCents,
    boardName: contest.board?.name ?? null,
    registrationStart: contest.registrationStart,
    registrationEnd: contest.registrationEnd,
    examDate: contest.examDate,
    feeText: contest.feeText,
    educationLevels: contest.educationLevels.length > 0 ? contest.educationLevels : positions.flatMap((position) => position.educationLevel ?? []),
  });
  const questionsHref = contest.board ? `/questoes?board=${contest.board.id}` : "/questoes";

  const sections = [
    { id: "visao-geral", label: "Visão geral", show: Boolean(contest.summary) },
    { id: "cargos", label: "Cargos", show: positions.length > 0 || Boolean(contest.positions) },
    { id: "cronograma", label: "Cronograma", show: true },
    { id: "etapas", label: "Etapas", show: stages.length > 0 },
    { id: "questoes", label: "Questões", show: true },
    { id: "noticias", label: "Notícias", show: contest.posts.length > 0 },
    { id: "perguntas", label: "Perguntas", show: true },
  ].filter((section) => section.show);

  const keyDates = [
    { label: "Inscrições", value: registration },
    { label: "Taxa de inscrição", value: contest.feeText ?? "A definir" },
    { label: "Prova objetiva", value: formatContestDate(contest.examDate) ?? "A definir" },
    { label: "Locais de prova", value: contest.examLocations ?? (state ? BRAZIL_STATES[state] : "A definir") },
    ...(contest.authorization ? [{ label: "Autorização", value: contest.authorization }] : []),
  ];

  // Structured data: breadcrumb + FAQ (what people search about the contest). "<" escaped.
  const jsonLd = JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Concursos", item: `${base}/concursos` },
        { "@type": "ListItem", position: 2, name: contest.name, item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })),
    },
  ]).replace(/</g, "\\u003c");

  return (
    <article className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <nav className={styles.breadcrumb} aria-label="Você está em">
            <Link href="/concursos">Concursos</Link>
            {contest.careerCategory ? (
              <>
                <span aria-hidden="true">›</span>
                <Link href={`/concursos?carreira=${contest.careerCategory.slug}`}>{contest.careerCategory.name}</Link>
              </>
            ) : null}
            <span aria-hidden="true">›</span>
            <Link href={state ? `/concursos?uf=${state.toLowerCase()}` : "/concursos"}>{state ? BRAZIL_STATES[state] : "Nacional"}</Link>
          </nav>

          <div className={styles.identity}>
            {contest.logoAssetId ? (
              <span className={styles.logo}>
                {/* eslint-disable-next-line @next/next/no-img-element -- media route (private bucket) */}
                <img src={contestLogoUrl(contest.logoAssetId)} alt={`Logo: ${contest.organizationName}`} />
              </span>
            ) : (
              <span className={styles.badge} aria-hidden="true">
                {organizationBadge(contest.organizationName)}
              </span>
            )}
            <div>
              <ContestStatusChip status={contest.status} />
              <h1>{contest.name}</h1>
              <p>{contest.organizationName}</p>
            </div>
          </div>

          <ul className={styles.tags}>
            <li>{state ? BRAZIL_STATES[state] : "Nacional"}</li>
            <li>Banca: {contest.board?.name ?? "a definir"}</li>
            {education ? <li>Nível {education.toLowerCase()}</li> : null}
            {contest.careerCategory ? <li>{contest.careerCategory.name}</li> : null}
          </ul>

          <dl className={styles.stats}>
            <div>
              <dt>Vagas</dt>
              <dd>{vacanciesLabel(contest.vacancies, contest.hasReserveList)}</dd>
            </div>
            <div>
              <dt>Salário</dt>
              <dd>{salaryLabel(contest.salaryMinCents, contest.salaryMaxCents)}</dd>
            </div>
            <div>
              <dt>Inscrições</dt>
              <dd>{registration}</dd>
            </div>
            <div>
              <dt>Prova</dt>
              <dd>{formatContestDate(contest.examDate) ?? "A definir"}</dd>
            </div>
          </dl>

          <div className={styles.heroActions}>
            <Link href={questionsHref} className={styles.primary}>
              {contest.board ? `Resolver questões ${contest.board.name}` : "Resolver questões grátis"}
            </Link>
            {contest.noticeUrl ? (
              <a href={contest.noticeUrl} target="_blank" rel="noopener noreferrer nofollow" className={styles.ghost}>
                Edital oficial ↗
              </a>
            ) : null}
            {contest.organization ? (
              <Link href={`/questoes?org=${contest.organization.id}`} className={styles.ghost}>
                Provas anteriores do órgão
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <nav className={styles.sectionNav} aria-label="Nesta página">
        <div>
          {sections.map((section) => (
            <a key={section.id} href={`#${section.id}`}>
              {section.label}
            </a>
          ))}
        </div>
      </nav>

      <div className={styles.layout}>
        <div className={styles.main}>
          {contest.summary ? (
            <section id="visao-geral" className={styles.section}>
              <h2>Visão geral</h2>
              <ArticleBody body={contest.summary} images={NO_IMAGES} />
            </section>
          ) : null}

          {positions.length > 0 || contest.positions ? (
            <section id="cargos" className={styles.section}>
              <h2>Cargos e vagas</h2>
              {positions.length > 0 ? (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">Cargo</th>
                        <th scope="col">Vagas</th>
                        <th scope="col">Remuneração</th>
                        <th scope="col">Escolaridade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((position) => (
                        <tr key={position.id}>
                          <th scope="row">
                            {position.name}
                            {position.requirements ? <small>{position.requirements}</small> : null}
                          </th>
                          <td>{vacanciesLabel(position.vacancies, position.hasReserveList)}</td>
                          <td>{position.salaryCents === null ? "A definir" : formatBRL(position.salaryCents)}</td>
                          <td>{position.educationLevel ? EDUCATION_LEVELS[position.educationLevel] : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className={styles.text}>{contest.positions}</p>
              )}
            </section>
          ) : null}

          <section id="cronograma" className={styles.section}>
            <h2>Cronograma</h2>
            <ol className={styles.timeline}>
              {timeline.map((step) => (
                <li key={step.label} className={styles[`step_${step.state}`]}>
                  <span className={styles.dot} aria-hidden="true" />
                  <strong>{step.label}</strong>
                  <small>{step.state === "current" ? "Etapa atual" : step.detail ?? (step.state === "done" ? "Concluído" : "Aguardando")}</small>
                </li>
              ))}
            </ol>
            <dl className={styles.dates}>
              {keyDates.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {stages.length > 0 ? (
            <section id="etapas" className={styles.section}>
              <h2>Etapas da seleção</h2>
              <ol className={styles.stages}>
                {stages.map((stage, index) => (
                  <li key={stage}>
                    <span>{index + 1}</span>
                    {stage}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <section id="questoes" className={styles.section}>
            <h2>Questões para treinar</h2>
            {contest.boardQuestions && contest.boardQuestions.total > 0 ? (
              <>
                <p className={styles.text}>
                  Temos <strong>{numberFormat.format(contest.boardQuestions.total)} questões</strong> da banca {contest.board?.name}, com
                  gabarito oficial. Comece pelas matérias que ela mais cobra:
                </p>
                <ul className={styles.subjects}>
                  {contest.boardQuestions.disciplines.map((discipline) => (
                    <li key={discipline.id}>
                      <Link href={`/questoes?board=${contest.board?.id}&discipline=${discipline.id}`}>
                        <strong>{discipline.name}</strong>
                        <span>{numberFormat.format(discipline.count)} questões</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className={styles.text}>
                {contest.board
                  ? `Ainda estamos incluindo provas da banca ${contest.board.name}. Enquanto isso, treine com as questões do banco.`
                  : "A banca ainda não foi definida. Enquanto isso, treine com as matérias que sempre caem em concursos da área."}
              </p>
            )}
            <Link href={questionsHref} className={styles.inlineCta}>
              Ver todas as questões →
            </Link>
          </section>

          {contest.posts.length > 0 ? (
            <section id="noticias" className={styles.section}>
              <h2>Notícias deste concurso</h2>
              <div className={styles.newsGrid}>
                {contest.posts.map((post) => (
                  <GridCard key={post.slug} post={post} now={now} />
                ))}
              </div>
            </section>
          ) : null}

          <section id="perguntas" className={styles.section}>
            <h2>Perguntas frequentes</h2>
            <div className={styles.faq}>
              {faq.map((item) => (
                <details key={item.question}>
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </section>

          <p className={styles.disclaimer}>
            Informações conferidas em fontes oficiais e atualizadas em {updatedFormat.format(contest.updatedAt)}. Confirme sempre no
            edital oficial.
          </p>
        </div>

        <aside className={styles.aside}>
          <div className={styles.asideCard}>
            <strong>Resumo do concurso</strong>
            <dl>
              <div>
                <dt>Situação</dt>
                <dd>
                  <ContestStatusChip status={contest.status} />
                </dd>
              </div>
              <div>
                <dt>Vagas</dt>
                <dd>{vacanciesLabel(contest.vacancies, contest.hasReserveList)}</dd>
              </div>
              <div>
                <dt>Banca</dt>
                <dd>{contest.board?.name ?? "A definir"}</dd>
              </div>
              <div>
                <dt>Prova</dt>
                <dd>{formatContestDate(contest.examDate) ?? "A definir"}</dd>
              </div>
            </dl>
            <Link href={questionsHref} className={styles.primary}>
              Treinar agora
            </Link>
          </div>

          {offer ? (
            <div className={styles.offerCard}>
              <span>Combo para este concurso</span>
              <strong>{offer.name}</strong>
              <b>
                {offer.compareAtCents ? <s>{formatBRL(offer.compareAtCents)}</s> : null} {formatBRL(offer.priceCents)}
              </b>
              <Link href={`/loja/${offer.slug}`}>Quero este combo</Link>
            </div>
          ) : (
            <div className={styles.offerCard}>
              <span>Sou Bizurado Premium</span>
              <strong>Questões e simulados ilimitados</strong>
              <b>{formatBRL(SUBSCRIPTION_PLANS[DEFAULT_SUBSCRIPTION_PLAN].amountCents)}/mês</b>
              <Link href="/assinatura">Assinar agora</Link>
            </div>
          )}

          <div className={styles.shareCard}>
            <strong>Compartilhe com quem vai prestar</strong>
            <ShareButtons url={url} title={contest.name} layout="row" />
          </div>
        </aside>
      </div>

      {contest.related.length > 0 ? (
        <section className={styles.related}>
          <h2>Concursos relacionados</h2>
          <div className={styles.relatedGrid}>
            {contest.related.map((item) => (
              <ContestCard key={item.slug} contest={item} />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
