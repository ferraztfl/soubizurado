import type { Metadata } from "next";

import { OfferDetail } from "@/app/loja/_components/offer-detail";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Loja", robots: { index: false } };

type StudentOfferPageProps = Readonly<{
  params: Promise<{ slug: string }>;
  searchParams: Promise<Readonly<{ erro?: string }>>;
}>;

export default async function StudentOfferPage(props: StudentOfferPageProps) {
  const { slug } = await props.params;
  const { erro } = await props.searchParams;

  return <OfferDetail slug={slug} erro={erro} basePath="/app/loja" />;
}
