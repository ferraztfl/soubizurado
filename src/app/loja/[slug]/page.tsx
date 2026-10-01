import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { formatBRL } from "@/modules/store/domain/store";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";

import { loadOffer, OfferDetail } from "../_components/offer-detail";

export const dynamic = "force-dynamic";

type OfferPageProps = Readonly<{
  params: Promise<{ slug: string }>;
  searchParams: Promise<Readonly<{ erro?: string }>>;
}>;

export async function generateMetadata({ params }: OfferPageProps): Promise<Metadata> {
  const offer = await loadOffer((await params).slug);

  return offer
    ? {
        title: `${offer.name} — ${formatBRL(offer.priceCents)}`,
        description: offer.headline ?? `Compre ${offer.name} no Sou Bizurado.`,
        alternates: { canonical: `/loja/${offer.slug}` },
      }
    : { title: "Oferta indisponível", robots: { index: false } };
}

export default async function OfferPage(props: OfferPageProps) {
  const { slug } = await props.params;
  const { erro } = await props.searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed-in students buy inside their own area (the error code is kept).
  if (user && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    redirect(`/app/loja/${slug}${erro && /^[a-z-]{1,30}$/.test(erro) ? `?erro=${erro}` : ""}`);
  }

  return <OfferDetail slug={slug} erro={erro} basePath="/loja" />;
}
