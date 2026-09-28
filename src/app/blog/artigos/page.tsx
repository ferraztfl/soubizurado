import type { Metadata } from "next";

import { parsePage, PostListPage } from "../_components/post-list-page";

export const dynamic = "force-dynamic";

type Props = Readonly<{ searchParams: Promise<Readonly<{ pagina?: string }>> }>;

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const page = parsePage((await searchParams).pagina);
  return {
    title: "Artigos e dicas de estudo para concursos",
    description: "Guias, estratégias e dicas de estudo para concursos públicos, por carreira e por banca.",
    alternates: { canonical: page > 1 ? `/blog/artigos?pagina=${page}` : "/blog/artigos" },
  };
}

export default async function ArticlesPage({ searchParams }: Props) {
  const page = parsePage((await searchParams).pagina);
  return (
    <PostListPage
      eyebrow="Artigos"
      title="Artigos e dicas de estudo"
      description="Guias e estratégias para estudar melhor para o seu concurso."
      filters={{ format: "ARTICLE" }}
      page={page}
      basePath="/blog/artigos"
    />
  );
}
