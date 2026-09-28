import type { Metadata } from "next";

import { parsePage, PostListPage } from "../_components/post-list-page";

export const dynamic = "force-dynamic";

type Props = Readonly<{ searchParams: Promise<Readonly<{ pagina?: string }>> }>;

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const page = parsePage((await searchParams).pagina);
  return {
    title: page > 1 ? `Últimas notícias de concursos — página ${page}` : "Últimas notícias de concursos",
    description: "Todas as notícias de concursos públicos: editais, vagas, salários e datas de prova.",
    alternates: { canonical: page > 1 ? `/blog/noticias?pagina=${page}` : "/blog/noticias" },
  };
}

export default async function LatestNewsPage({ searchParams }: Props) {
  const page = parsePage((await searchParams).pagina);
  return <PostListPage eyebrow="Blog" title="Últimas notícias" filters={{}} page={page} basePath="/blog/noticias" />;
}
