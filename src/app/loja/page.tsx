import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";

import { StoreListing } from "./_components/store-listing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Loja — planos e combos para concursos",
  description: "Assine o Premium do Sou Bizurado ou escolha o combo do seu concurso: questões ilimitadas, simulados e material.",
  alternates: { canonical: "/loja" },
};

export default async function StorePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed-in students shop inside their own area, so they never feel they left it.
  if (user) {
    redirect("/app/loja");
  }

  return <StoreListing basePath="/loja" profileId={null} />;
}
