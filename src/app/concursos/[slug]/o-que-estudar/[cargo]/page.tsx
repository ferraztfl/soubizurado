import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { contestLogoUrl, formatContestDate } from "@/modules/contests/domain/contest";
import { totalQuestions } from "@/modules/contests/domain/syllabus";
import { loadStudiedTopicIds } from "@/modules/contests/infrastructure/syllabus-store";
import { siteUrl } from "@/modules/question-bank/infrastructure/queries/question-sitemap";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import { loadSiteViewer } from "../../../../_components/site-viewer";
import { SyllabusChecklist } from "./syllabus-checklist";
import styles from "./syllabus-page.module.css";

export const dynamic = "force-dynamic";

type SyllabusPageProps = Readonly<{ params: Promise<{ slug: string; cargo: string }> }>;

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const loadSyllabus = cache(async (contestSlug: string, syllabusSlug: string) => {
  if (!SLUG.test(contestSlug) || !SLUG.test(syllabusSlug)) return null;
  return getPrismaClient().contestSyllabus.findFirst({
    where: { slug: syllabusSlug, isPublished: true, contest: { slug: contestSlug, isPublished: true } },
    select: {
      id: true,
      title: true,
      slug: true,
      essayPoints: true,
      durationMinutes: true,
      notes: true,
      updatedAt: true,
      contest: {
        select: {
          slug: true,
          name: true,
          organizationName: true,
          examDate: true,
          logoAssetId: true,
          board: { select: { id: true, name: true } },
          syllabi: { where: { isPublished: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { slug: true, title: true } },
        },
      },
      subjects: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          questionCount: true,
          block: true,
          disciplineId: true,
          topics: { orderBy: { sortOrder: "asc" }, select: { id: true, code: true, text: true } },
        },
      },
    },
  });
});

export async function generateMetadata({ params }: SyllabusPageProps): Promise<Metadata> {
  const { slug, cargo } = await params;
  const syllabus = await loadSyllabus(slug, cargo);
  if (!syllabus) return { title: "Edital verticalizado não encontrado", robots: { index: false } };

  const questions = totalQuestions(syllabus.subjects);
  const title = `Edital verticalizado ${syllabus.title} — ${syllabus.contest.name}`;
  const description = `O que estudar para ${syllabus.title} (${syllabus.contest.name}): ${syllabus.subjects.length} matérias${
    questions === null ? "" : `, ${questions} questões`
  } e todos os assuntos do conteúdo programático, com checklist para marcar o que você já estudou.`;
  const url = `/concursos/${syllabus.contest.slug}/o-que-estudar/${syllabus.slug}`;

  return {
    title,
    description: description.slice(0, 300),
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title,
      description: description.slice(0, 300),
      url,
      siteName: "Sou Bizurado",
      locale: "pt_BR",
      ...(syllabus.contest.logoAssetId ? { images: [{ url: contestLogoUrl(syllabus.contest.logoAssetId) }] } : {}),
    },
  };
}

/** Public "edital verticalizado" of one position, with the student's checklist. */
export default async function ContestSyllabusPage({ params }: SyllabusPageProps) {
  const { slug, cargo } = await params;
  const [syllabus, viewer] = await Promise.all([loadSyllabus(slug, cargo), loadSiteViewer()]);
  if (!syllabus) notFound();

  const { contest } = syllabus;
  const topicIds = syllabus.subjects.flatMap((subject) => subject.topics.map((topic) => topic.id));
  const studied = viewer.profileId ? await loadStudiedTopicIds(viewer.profileId, topicIds) : new Set<string>();
  const questions = totalQuestions(syllabus.subjects);
  const path = `/concursos/${contest.slug}/o-que-estudar/${syllabus.slug}`;
  const base = siteUrl();

  const questionsHref = (disciplineId: string | null) =>
    disciplineId ? `/questoes?${contest.board ? `board=${contest.board.id}&` : ""}discipline=${disciplineId}` : null;

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Concursos", item: `${base}/concursos` },
      { "@type": "ListItem", position: 2, name: contest.name, item: `${base}/concursos/${contest.slug}` },
      { "@type": "ListItem", position: 3, name: `Edital verticalizado — ${syllabus.title}`, item: `${base}${path}` },
    ],
  }).replace(/</g, "\\u003c");

  return (
    <article className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      <nav className={styles.breadcrumb} aria-label="Você está em">
        <Link href="/concursos">Concursos</Link>
        <span aria-hidden="true">›</span>
        <Link href={`/concursos/${contest.slug}`}>{contest.name}</Link>
        <span aria-hidden="true">›</span>
        <span>O que estudar</span>
      </nav>

      <header className={styles.header}>
        <span className={styles.eyebrow}>Edital verticalizado</span>
        <h1>
          {syllabus.title} <small>{contest.name}</small>
        </h1>
        <ul className={styles.facts}>
          <li>
            <strong>{syllabus.subjects.length}</strong> matérias
          </li>
          {questions === null ? null : (
            <li>
              <strong>{questions}</strong> questões objetivas
            </li>
          )}
          {syllabus.essayPoints === null ? null : (
            <li>
              Redação: <strong>{syllabus.essayPoints} pontos</strong>
            </li>
          )}
          {contest.board ? (
            <li>
              Banca: <strong>{contest.board.name}</strong>
            </li>
          ) : null}
          {contest.examDate ? (
            <li>
              Prova: <strong>{formatContestDate(contest.examDate)}</strong>
            </li>
          ) : null}
        </ul>
        {contest.syllabi.length > 1 ? (
          <nav className={styles.positions} aria-label="Outros cargos">
            {contest.syllabi.map((item) =>
              item.slug === syllabus.slug ? (
                <span key={item.slug} aria-current="page">
                  {item.title}
                </span>
              ) : (
                <Link key={item.slug} href={`/concursos/${contest.slug}/o-que-estudar/${item.slug}`}>
                  {item.title}
                </Link>
              ),
            )}
          </nav>
        ) : null}
      </header>

      {syllabus.notes ? <p className={styles.notes}>{syllabus.notes}</p> : null}

      <SyllabusChecklist
        subjects={syllabus.subjects.map((subject) => ({
          id: subject.id,
          name: subject.name,
          questionCount: subject.questionCount,
          block: subject.block,
          questionsHref: questionsHref(subject.disciplineId),
          topics: subject.topics,
        }))}
        initialStudied={[...studied]}
        signedIn={viewer.signedIn}
        loginHref={`/login?next=${encodeURIComponent(path)}`}
      />

      <p className={styles.disclaimer}>
        Conteúdo programático transcrito do edital oficial de {contest.organizationName}. Em caso de divergência, vale o edital
        publicado. Atualizado em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(syllabus.updatedAt)}.
      </p>
    </article>
  );
}
