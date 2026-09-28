import type { Metadata } from "next";
import Link from "next/link";

import { BRAZIL_STATES, parseStateCode } from "@/modules/blog/domain/blog";
import { loadEditorials } from "@/modules/blog/infrastructure/blog-queries";
import { CONTEST_TABS, parseContestTab, type ContestTab } from "@/modules/contests/domain/contest";
import { listContests } from "@/modules/contests/infrastructure/contest-queries";

import { ContestCard } from "./_components/contest-card";
import styles from "./concursos.module.css";

export const dynamic = "force-dynamic";

type ContestsPageProps = Readonly<{
  searchParams: Promise<Readonly<{ aba?: string; uf?: string; carreira?: string; pagina?: string }>>;
}>;

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function generateMetadata({ searchParams }: ContestsPageProps): Promise<Metadata> {
  const params = await searchParams;
  const filtered = Boolean(params.aba || params.uf || params.carreira || params.pagina);
  const year = new Date().getFullYear();

  return {
    title: `Concursos públicos ${year}: abertos, previstos e editais publicados`,
    description:
      "Acompanhe os concursos públicos de todo o Brasil: editais publicados, inscrições abertas, concursos autorizados e previstos, com vagas, salários, banca e datas.",
    alternates: { canonical: "/concursos" },
    // Filtered combinations are not separate pages for Google.
    ...(filtered ? { robots: { index: false, follow: true } } : {}),
  };
}

function hrefWith(params: Readonly<{ aba: ContestTab; uf: string | null; carreira: string | null }>, page = 1): string {
  const search = new URLSearchParams();
  if (params.aba !== "destaques") search.set("aba", params.aba);
  if (params.uf) search.set("uf", params.uf.toLowerCase());
  if (params.carreira) search.set("carreira", params.carreira);
  if (page > 1) search.set("pagina", String(page));
  const query = search.toString();
  return query ? `/concursos?${query}` : "/concursos";
}

export default async function ContestsPage({ searchParams }: ContestsPageProps) {
  const params = await searchParams;
  const tab = parseContestTab(params.aba);
  const stateCode = parseStateCode(params.uf ?? null);
  const careerSlug = params.carreira && SLUG.test(params.carreira) ? params.carreira : null;
  const page = Math.max(1, Math.min(500, Number.parseInt(params.pagina ?? "1", 10) || 1));
  const current = { aba: tab, uf: stateCode, carreira: careerSlug };

  const [{ contests, total, totalPages }, editorials] = await Promise.all([
    listContests({ tab, stateCode, careerSlug }, page),
    loadEditorials(),
  ]);
  const careers = [...editorials.careers, ...editorials.exams];

  return (
    <div className={styles.listPage}>
      <header className={styles.pageHeader}>
        <span className={styles.eyebrow}>Concursos públicos</span>
        <h1>Concursos abertos, previstos e com edital publicado</h1>
        <p>
          Vagas, salários, banca e datas de cada concurso, conferidos no edital oficial — e questões da banca para você
          começar a treinar hoje.
        </p>
      </header>

      <nav className={styles.tabs} aria-label="Situação">
        {(Object.keys(CONTEST_TABS) as ContestTab[]).map((key) => (
          <Link key={key} href={hrefWith({ ...current, aba: key })} className={key === tab ? styles.tabActive : styles.tab}>
            {CONTEST_TABS[key].label}
          </Link>
        ))}
      </nav>

      <form className={styles.filters} action="/concursos">
        {tab !== "destaques" ? <input type="hidden" name="aba" value={tab} /> : null}
        <label>
          <span>Estado</span>
          <select name="uf" defaultValue={stateCode?.toLowerCase() ?? ""}>
            <option value="">Todos</option>
            {Object.entries(BRAZIL_STATES).map(([code, name]) => (
              <option key={code} value={code.toLowerCase()}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Carreira</span>
          <select name="carreira" defaultValue={careerSlug ?? ""}>
            <option value="">Todas</option>
            {careers.map((career) => (
              <option key={career.slug} value={career.slug}>
                {career.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Filtrar</button>
        {stateCode || careerSlug ? <Link href={hrefWith({ aba: tab, uf: null, carreira: null })}>Limpar filtros</Link> : null}
      </form>

      <p className={styles.count}>
        {total === 0 ? "Nenhum concurso encontrado." : `${total} ${total === 1 ? "concurso" : "concursos"}`}
      </p>

      {contests.length > 0 ? (
        <div className={styles.grid}>
          {contests.map((contest) => (
            <ContestCard key={contest.slug} contest={contest} />
          ))}
        </div>
      ) : (
        <p className={styles.empty}>
          Ainda não há concursos nesta lista. Enquanto isso, <Link href="/questoes">resolva questões grátis</Link> ou veja as{" "}
          <Link href="/blog/editoria/editais">notícias de editais</Link>.
        </p>
      )}

      {totalPages > 1 ? (
        <nav className={styles.pager} aria-label="Páginas">
          {page > 1 ? <Link href={hrefWith(current, page - 1)}>← Anteriores</Link> : <span />}
          <span>
            Página {page} de {totalPages}
          </span>
          {page < totalPages ? <Link href={hrefWith(current, page + 1)}>Próximos →</Link> : <span />}
        </nav>
      ) : null}
    </div>
  );
}
