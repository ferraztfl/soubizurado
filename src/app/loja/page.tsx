import type { Metadata } from "next";
import Link from "next/link";

import { formatBRL } from "@/modules/store/domain/store";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import styles from "./loja.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Loja — planos e combos para concursos",
  description: "Assine o Premium do Sou Bizurado ou escolha o combo do seu concurso: questões ilimitadas, simulados e material.",
  alternates: { canonical: "/loja" },
};

function premiumLabel(days: number | null | undefined): string {
  if (days === undefined) return "";
  if (days === null) return "Premium sem prazo";
  if (days % 30 === 0 && days <= 360) return `Premium por ${days / 30} ${days === 30 ? "mês" : "meses"}`;
  return `Premium por ${days} dias`;
}

export default async function StorePage() {
  const offers = await getPrismaClient().offer.findMany({
    where: { isActive: true },
    orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      slug: true,
      name: true,
      headline: true,
      priceCents: true,
      compareAtCents: true,
      isFeatured: true,
      grants: { select: { kind: true, durationDays: true } },
    },
  });

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>Loja</span>
        <h1>Estude sem limites</h1>
        <p>
          Questões e simulados ilimitados, revisão espaçada dos seus erros e combos preparados para o seu concurso.
          Pagamento seguro pelo Mercado Pago (Pix, cartão ou boleto).
        </p>
      </header>

      {offers.length === 0 ? (
        <p className={styles.empty}>
          Novas ofertas em breve. Enquanto isso, <Link href="/questoes">resolva questões grátis</Link>.
        </p>
      ) : (
        <ul className={styles.grid}>
          {offers.map((offer) => (
            <li key={offer.slug} className={offer.isFeatured ? styles.offerFeatured : styles.offer}>
              {offer.isFeatured ? <span className={styles.ribbon}>Mais vendido</span> : null}
              <h2>{offer.name}</h2>
              {offer.headline ? <p className={styles.headline}>{offer.headline}</p> : null}
              <p className={styles.includes}>
                {premiumLabel(offer.grants.find((grant) => grant.kind === "QUESTION_BANK")?.durationDays)}
              </p>
              <div className={styles.price}>
                {offer.compareAtCents ? <s>{formatBRL(offer.compareAtCents)}</s> : null}
                <strong>{formatBRL(offer.priceCents)}</strong>
              </div>
              <Link href={`/loja/${offer.slug}`} className={styles.buy}>
                Ver detalhes e comprar
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
