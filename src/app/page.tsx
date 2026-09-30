import type { Metadata } from "next";
import Link from "next/link";

import { listPosts } from "@/modules/blog/infrastructure/blog-queries";
import { CONTEST_TABS } from "@/modules/contests/domain/contest";
import { loadContestShowcase } from "@/modules/contests/infrastructure/contest-queries";
import { loadHomeHighlights } from "@/modules/question-bank/infrastructure/queries/home-highlights";
import { FREE_DAILY_ANSWERS } from "@/modules/study/domain/access";
import { withEffectivePrice } from "@/modules/store/domain/offer-price";
import { formatBRL } from "@/modules/store/domain/store";
import { DEFAULT_SUBSCRIPTION_PLAN, SUBSCRIPTION_PLANS } from "@/modules/store/domain/subscription";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import { ComboCarousel, type ComboSlide } from "./_components/combo-carousel";
import { SiteShell } from "./_components/site-shell";
import { loadSiteViewer } from "./_components/site-viewer";
import { BlogIcon } from "./blog/_components/blog-icon";
import { ContestCard } from "./concursos/_components/contest-card";
import { ContestTabs } from "./concursos/_components/contest-tabs";
import contestStyles from "./concursos/concursos.module.css";
import { NewsletterBox } from "./blog/_components/newsletter-box";
import { GridCard } from "./blog/_components/post-cards";
import styles from "./home.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Sou Bizurado — questões de concursos públicos com gabarito" },
  description:
    "Resolva questões de concursos públicos e do ENEM com gabarito, por matéria e banca. Revisão dos seus erros, simulados, notícias de concursos e combos para o seu edital.",
  alternates: { canonical: "/" },
};

const numberFormat = new Intl.NumberFormat("pt-BR");

const BENEFITS = [
  {
    title: "Questões com gabarito, organizadas do jeito certo",
    text: "Filtre por matéria, tópico, banca, órgão, cargo e ano. Cada questão é classificada pela nossa equipe, com o gabarito oficial da prova.",
  },
  {
    title: "Seus erros voltam no dia certo",
    text: "A revisão espaçada traz de volta as questões que você errou até você dominar o assunto — sem precisar montar listas.",
  },
  {
    title: "Simulados no tempo da prova",
    text: "Monte simulados com as matérias do seu edital e veja em que assuntos está perdendo pontos.",
  },
  {
    title: "Metas, missões e ranking",
    text: "Meta diária de questões, missões semanais e ranking para manter o ritmo até o dia da prova.",
  },
  {
    title: "Combos para o seu concurso",
    text: "Questões ilimitadas + material específico do edital em um só pagamento, por Pix, cartão ou boleto.",
  },
] as const;

export default async function Home() {
  const now = new Date();
  const [viewer, highlights, offers, news, showcase] = await Promise.all([
    loadSiteViewer(),
    loadHomeHighlights(),
    getPrismaClient().offer.findMany({
      where: { isActive: true },
      orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      take: 8,
      select: {
        slug: true,
        bannerAssetId: true,
        name: true,
        headline: true,
        priceCents: true,
        compareAtCents: true,
        promoEndsAt: true,
        isFeatured: true,
        grants: { select: { kind: true, durationDays: true } },
      },
    }).then((rows) => rows.map((row) => withEffectivePrice(row, now))),
    listPosts({}, 1, now),
    loadContestShowcase(),
  ]);
  const signedIn = viewer.signedIn;
  const combo = offers[0] ?? null;
  const slides: ComboSlide[] = offers.map((offer) => ({
    slug: offer.slug,
    name: offer.name,
    headline: offer.headline,
    price: formatBRL(offer.priceCents),
    compareAt: offer.compareAtCents ? formatBRL(offer.compareAtCents) : null,
    bannerUrl: offer.bannerAssetId ? `/api/loja/banners/${offer.bannerAssetId}` : null,
  }));
  const monthly = SUBSCRIPTION_PLANS[DEFAULT_SUBSCRIPTION_PLAN];
  const enemBoard = highlights.topBoards.find((board) => board.name === "INEP");

  const goals = [
    {
      icon: "badge",
      title: "Passar em um concurso",
      text: "Questões de provas anteriores, por banca e cargo.",
      href: "/questoes",
      action: "Resolver questões",
    },
    {
      icon: "pencil",
      title: "Mandar bem no ENEM",
      text: "Provas oficiais do INEP com gabarito.",
      href: enemBoard ? `/questoes?board=${enemBoard.id}` : "/blog/editoria/enem",
      action: "Treinar para o ENEM",
    },
    {
      icon: "megaphone",
      title: "Acompanhar concursos",
      text: "Editais publicados, previstos e datas de prova.",
      href: "/concursos",
      action: "Ver concursos",
    },
    {
      icon: "briefcase",
      title: "Estudar com um combo",
      text: "Questões ilimitadas + material do seu edital.",
      href: "/loja",
      action: "Ver planos",
    },
  ] as const;

  return (
    <SiteShell mainClassName={styles.homeMain}>
      <>
        {slides.length > 0 ? (
          <div className={styles.carouselBand}>
            <ComboCarousel slides={slides} />
          </div>
        ) : null}

        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <span className={styles.eyebrow}>Preparação para concursos públicos e ENEM</span>
              <h1>
                Questões de concursos com gabarito, <span>do jeito que a banca cobra.</span>
              </h1>
              <p>
                Treine com provas anteriores, revise seus erros no dia certo e acompanhe as notícias do seu concurso — tudo em
                um só lugar. Comece grátis: {FREE_DAILY_ANSWERS.free} questões por dia com a sua conta.
              </p>
              <form action="/questoes" className={styles.heroSearch} role="search">
                <label className={styles.srOnly} htmlFor="hero-search">
                  O que você quer estudar?
                </label>
                <input id="hero-search" name="q" type="search" placeholder="Ex.: crase, Lei 8.112, PMPE, porcentagem" maxLength={120} />
                <button type="submit">Buscar questões</button>
              </form>
              <div className={styles.heroLinks}>
                <Link href={signedIn ? "/app" : "/cadastro"} className={styles.heroPrimary}>
                  {signedIn ? "Ir para minha área" : "Criar conta grátis"}
                </Link>
                <Link href="/questoes" className={styles.heroGhost}>
                  Resolver uma questão agora, sem cadastro
                </Link>
              </div>
            </div>

            <div className={styles.plans}>
              <article className={styles.plan}>
                <h2>Grátis</h2>
                <p>{FREE_DAILY_ANSWERS.free} questões por dia, revisão dos erros e metas.</p>
                <div className={styles.planPrice}>
                  <strong>R$ 0</strong>
                </div>
                <Link href={signedIn ? "/app" : "/cadastro"}>{signedIn ? "Minha área →" : "Criar conta →"}</Link>
              </article>
              <article className={styles.planFeatured}>
                <span className={styles.planRibbon}>Recomendado</span>
                <h2>Premium</h2>
                <p>Questões e simulados ilimitados. Cancele quando quiser.</p>
                <div className={styles.planPrice}>
                  <strong>{formatBRL(monthly.amountCents)}</strong>
                  <span className={styles.perMonth}>por mês</span>
                </div>
                <Link href="/assinatura">{viewer.premium ? "Minha assinatura →" : "Assinar →"}</Link>
              </article>
              {combo ? (
                <article className={styles.plan}>
                  <h2>{combo.name}</h2>
                  {combo.headline ? <p>{combo.headline}</p> : <p>Pagamento único por Pix, cartão ou boleto.</p>}
                  <div className={styles.planPrice}>
                    {combo.compareAtCents ? <s>{formatBRL(combo.compareAtCents)}</s> : null}
                    <strong>{formatBRL(combo.priceCents)}</strong>
                  </div>
                  <Link href={`/loja/${combo.slug}`}>Ver combo →</Link>
                </article>
              ) : null}
            </div>
          </div>
        </section>

        {highlights.questions > 0 ? (
          <section className={styles.stats} aria-label="O Sou Bizurado em números">
            <div>
              <strong>{numberFormat.format(highlights.questions)}</strong>
              <span>questões publicadas</span>
            </div>
            <div>
              <strong>{numberFormat.format(highlights.boards)}</strong>
              <span>bancas organizadoras</span>
            </div>
            <div>
              <strong>{numberFormat.format(highlights.organizations)}</strong>
              <span>órgãos e instituições</span>
            </div>
            <div>
              <strong>{numberFormat.format(highlights.disciplineCount)}</strong>
              <span>matérias com questões</span>
            </div>
          </section>
        ) : null}

        <div className={styles.container}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Qual é o seu próximo objetivo?</h2>
            <div className={styles.goals}>
              {goals.map((goal) => (
                <Link key={goal.title} href={goal.href} className={styles.goal}>
                  <span className={styles.goalIcon}>
                    <BlogIcon name={goal.icon} />
                  </span>
                  <strong>{goal.title}</strong>
                  <span>{goal.text}</span>
                  <em>{goal.action} →</em>
                </Link>
              ))}
            </div>
          </section>

          {showcase.length > 0 ? (
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>Principais concursos</h2>
                <Link href="/concursos">Ver todos os concursos →</Link>
              </div>
              <ContestTabs
                panels={showcase.map((entry) => ({
                  key: entry.tab,
                  label: CONTEST_TABS[entry.tab].label,
                  content: (
                    <div className={contestStyles.grid}>
                      {entry.contests.map((contest) => (
                        <ContestCard key={contest.slug} contest={contest} />
                      ))}
                    </div>
                  ),
                }))}
              />
            </section>
          ) : null}

          {highlights.disciplines.length > 0 ? (
            <section id="materias" className={styles.section}>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>Questões por matéria</h2>
                <Link href="/questoes">Ver todas as questões →</Link>
              </div>
              <ul className={styles.subjects}>
                {highlights.disciplines.map((discipline) => (
                  <li key={discipline.id}>
                    <Link href={`/questoes?discipline=${discipline.id}`}>
                      <strong>{discipline.name}</strong>
                      <span>{numberFormat.format(discipline.count)} questões</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {highlights.topBoards.length > 0 ? (
            <section id="bancas" className={styles.section}>
              <h2 className={styles.sectionTitle}>Questões por banca</h2>
              <ul className={styles.boards}>
                {highlights.topBoards.map((board) => (
                  <li key={board.id}>
                    <Link href={`/questoes?board=${board.id}`}>
                      {board.name} <span>{numberFormat.format(board.count)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className={styles.benefitsSection}>
            <div className={styles.benefitsIntro}>
              <span className={styles.badge}>Atenção, concurseiro!</span>
              <h2>Tudo o que você precisa para transformar o edital em aprovação</h2>
              <p>
                Comece grátis e, quando quiser acelerar, assine o Premium ou o combo do seu concurso.
              </p>
            </div>
            <div className={styles.benefits}>
              {BENEFITS.map((benefit, index) => (
                <details key={benefit.title} open={index === 0}>
                  <summary>{benefit.title}</summary>
                  <p>{benefit.text}</p>
                </details>
              ))}
            </div>
            <Link href="/loja" className={styles.benefitsCta}>
              Conheça os planos →
            </Link>
          </section>

          {news.posts.length > 0 ? (
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>Notícias em destaque</h2>
                <Link href="/blog">Ver todas as notícias →</Link>
              </div>
              <div className={styles.news}>
                {news.posts.slice(0, 8).map((post) => (
                  <GridCard key={post.slug} post={post} now={now} />
                ))}
              </div>
            </section>
          ) : null}

          <section className={styles.section}>
            <NewsletterBox variant="band" />
          </section>
        </div>
      </>
    </SiteShell>
  );
}
