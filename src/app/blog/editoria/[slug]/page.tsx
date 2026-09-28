import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import { parsePage, PostListPage } from "../../_components/post-list-page";

export const dynamic = "force-dynamic";

type Props = Readonly<{ params: Promise<{ slug: string }>; searchParams: Promise<Readonly<{ pagina?: string }>> }>;

const loadCategory = cache((slug: string) =>
  /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)
    ? getPrismaClient().blogCategory.findUnique({ where: { slug }, select: { slug: true, name: true, description: true, groupKey: true } })
    : null,
);

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const category = await loadCategory((await params).slug);
  if (!category) return { title: "Editoria não encontrada", robots: { index: false } };
  const page = parsePage((await searchParams).pagina);
  return {
    title: `${category.name} — notícias de concursos`,
    description: category.description ?? `Notícias, editais e dicas de concursos da área ${category.name}.`,
    alternates: { canonical: page > 1 ? `/blog/editoria/${category.slug}?pagina=${page}` : `/blog/editoria/${category.slug}` },
  };
}

export default async function EditorialPage({ params, searchParams }: Props) {
  const category = await loadCategory((await params).slug);
  if (!category) notFound();

  return (
    <PostListPage
      eyebrow={category.groupKey === "EXAME" ? "Exames" : category.groupKey === "CARREIRA" ? "Carreiras" : "Editoria"}
      title={category.name}
      description={category.description ?? `Notícias, editais e dicas de concursos: ${category.name}.`}
      filters={{ categorySlug: category.slug }}
      page={parsePage((await searchParams).pagina)}
      basePath={`/blog/editoria/${category.slug}`}
      activeCategory={category.slug}
    />
  );
}
