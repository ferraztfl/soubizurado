import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BRAZIL_STATES, parseStateCode } from "@/modules/blog/domain/blog";

import { parsePage, PostListPage } from "../../_components/post-list-page";

export const dynamic = "force-dynamic";

type Props = Readonly<{ params: Promise<{ uf: string }>; searchParams: Promise<Readonly<{ pagina?: string }>> }>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const code = parseStateCode((await params).uf);
  if (!code) return { title: "Região não encontrada", robots: { index: false } };
  return {
    title: `Concursos ${code} — notícias de concursos em ${BRAZIL_STATES[code]}`,
    description: `Editais, vagas e datas de prova de concursos públicos em ${BRAZIL_STATES[code]}.`,
    alternates: { canonical: `/blog/regiao/${code.toLowerCase()}` },
  };
}

export default async function RegionPage({ params, searchParams }: Props) {
  const code = parseStateCode((await params).uf);
  if (!code) notFound();

  return (
    <PostListPage
      eyebrow="Notícias por região"
      title={`Concursos em ${BRAZIL_STATES[code]}`}
      description={`Editais, vagas e datas de prova de concursos públicos em ${BRAZIL_STATES[code]} (${code}).`}
      filters={{ stateCode: code }}
      page={parsePage((await searchParams).pagina)}
      basePath={`/blog/regiao/${code.toLowerCase()}`}
    />
  );
}
