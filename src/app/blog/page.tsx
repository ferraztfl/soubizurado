import type { Metadata } from "next";
import Link from "next/link";

import { loadBannerOffer, loadPortalHome } from "@/modules/blog/infrastructure/blog-queries";
import { formatBRL } from "@/modules/store/domain/store";
import { DEFAULT_SUBSCRIPTION_PLAN, SUBSCRIPTION_PLANS } from "@/modules/store/domain/subscription";

import { FeaturedTicker } from "./_components/featured-ticker";
import { ArticleCard, GridCard, HeroPost, ListItem } from "./_components/post-cards";
import { BlogSidebar } from "./_components/sidebar";
import styles from "./portal.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog de concursos — notícias, editais e dicas de estudo",
  description:
    "Notícias de concursos públicos de todo o Brasil: editais, vagas, salários, datas de prova e dicas de estudo — e questões grátis para treinar.",
  alternates: { canonical: "/blog", types: { "application/rss+xml": "/blog/rss.xml" } },
};

export default async function BlogHomePage() {
  const now = new Date();
  const [{ hero, grid, list, featured, articles }, offer] = await Promise.all([loadPortalHome(now), loadBannerOffer()]);

  return (
    <div className={styles.home}>
      <section className={styles.banner} aria-label="Destaque da Loja">
        <div className={styles.bannerText}>
          <strong>
            Questões <span>ilimitadas</span> para o seu concurso
          </strong>
          <p>Banco de questões com gabarito, revisão dos seus erros, simulados e combos por concurso.</p>
        </div>
        <div className={styles.bannerOffer}>
          <span>Premium mensal</span>
          <strong>{formatBRL(SUBSCRIPTION_PLANS[DEFAULT_SUBSCRIPTION_PLAN].amountCents)}/mês</strong>
          <Link href="/assinatura">Assinar agora</Link>
          {offer ? (
            <Link href={`/loja/${offer.slug}`} className={styles.bannerAlt}>
              ou {offer.name} por {formatBRL(offer.priceCents)}
            </Link>
          ) : null}
        </div>
      </section>

      <FeaturedTicker items={(featured.length > 0 ? featured : grid).map((post) => ({ slug: post.slug, title: post.title }))} />

      {hero ? (
        <>
          <HeroPost post={hero} now={now} />
          {grid.length > 0 ? (
            <div className={styles.grid}>
              {grid.map((post) => (
                <GridCard key={post.slug} post={post} now={now} />
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <p className={styles.empty}>
          As primeiras notícias estão chegando. Enquanto isso, <Link href="/questoes">resolva questões grátis</Link>.
        </p>
      )}

      <div className={styles.columns}>
        <div className={styles.main}>
          <div className={styles.sectionHead}>
            <h2>Últimas notícias</h2>
            <Link href="/blog/noticias">Veja mais →</Link>
          </div>
          {list.length === 0 ? (
            <p className={styles.muted}>Mais notícias em breve.</p>
          ) : (
            <div className={styles.list}>
              {list.map((post) => (
                <ListItem key={post.slug} post={post} now={now} />
              ))}
            </div>
          )}

          {articles.length > 0 ? (
            <>
              <div className={styles.sectionHead}>
                <h2>Artigos em destaque</h2>
                <Link href="/blog/artigos">Veja mais →</Link>
              </div>
              <div className={styles.articles}>
                {articles.map((post) => (
                  <ArticleCard key={post.slug} post={post} />
                ))}
              </div>
            </>
          ) : null}
        </div>
        <BlogSidebar />
      </div>

      <section className={styles.platform} aria-label="Estude no Sou Bizurado">
        <h2>
          Leu a notícia? <span>Agora é treinar.</span>
        </h2>
        <p>Tudo o que você precisa para transformar o edital em aprovação, em um só lugar.</p>
        <ul>
          <li>
            <strong>Questões com gabarito</strong>
            <span>Por matéria, banca, órgão e ano — responda grátis todos os dias.</span>
          </li>
          <li>
            <strong>Revisão dos seus erros</strong>
            <span>As questões que você erra voltam no dia certo até você dominar.</span>
          </li>
          <li>
            <strong>Simulados e desempenho</strong>
            <span>Treine no tempo da prova e veja onde está perdendo pontos.</span>
          </li>
          <li>
            <strong>Combos por concurso</strong>
            <span>Questões ilimitadas + material do seu edital com preço de lançamento.</span>
          </li>
        </ul>
        <div className={styles.platformActions}>
          <Link href="/questoes" className={styles.buttonLight}>
            Resolver questões grátis
          </Link>
          <Link href="/cadastro" className={styles.buttonGhost}>
            Criar conta grátis
          </Link>
        </div>
      </section>

      <details className={styles.about}>
        <summary>
          <h2>Concursos públicos</h2>
          <span>Veja mais</span>
        </summary>
        <div>
          <p>
            No blog do <strong>Sou Bizurado</strong> você acompanha o que acontece no mundo dos <strong>concursos públicos</strong>:
            editais publicados e previstos, número de vagas, salários, bancas organizadoras, datas de inscrição e de prova, em
            todas as regiões do país.
          </p>
          <p>
            Além das notícias, publicamos guias e dicas de estudo para cada carreira — policial, fiscal, tribunais, educação,
            saúde, TI e muitas outras — e indicamos questões de provas anteriores da mesma banca para você treinar logo depois
            de ler.
          </p>
          <p>
            Quer acompanhar um concurso específico? Use a busca, navegue pelas editorias ou pela sua região e cadastre seu
            e-mail para receber as novidades.
          </p>
        </div>
      </details>
    </div>
  );
}
