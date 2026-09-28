import type { Metadata } from "next";

import { parsePage, PostListPage } from "../_components/post-list-page";

export const dynamic = "force-dynamic";

type Props = Readonly<{ searchParams: Promise<Readonly<{ q?: string; pagina?: string }>> }>;

export const metadata: Metadata = { title: "Busca no blog", robots: { index: false, follow: true } };

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = (params.q ?? "").replace(/\s+/g, " ").trim().slice(0, 100);

  return (
    <PostListPage
      eyebrow="Busca"
      title={query ? `Resultados para "${query}"` : "Buscar no blog"}
      description={query ? undefined : "Digite o nome do concurso, do órgão ou da banca na busca do topo. Abaixo, as últimas publicações."}
      filters={query.length >= 2 ? { query } : {}}
      page={parsePage(params.pagina)}
      basePath="/blog/busca"
      query={query ? { q: query } : {}}
    />
  );
}
