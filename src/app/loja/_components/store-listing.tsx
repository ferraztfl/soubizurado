import Link from "next/link";

import { withEffectivePrice } from "@/modules/store/domain/offer-price";
import { formatBRL } from "@/modules/store/domain/store";
import { loadOfferOwnership } from "@/modules/store/infrastructure/offer-ownership";
import { monthlyPriceLabel } from "@/modules/store/domain/subscription";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import styles from "../loja.module.css";

const ENDS = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });

function premiumLabel(days: number | null | undefined): string {
  if (days === undefined) return "";
  if (days === null) return "Premium sem prazo";
  if (days % 30 === 0 && days <= 360) return `Premium por ${days / 30} ${days === 30 ? "mês" : "meses"}`;
  return `Premium por ${days} dias`;
}

/**
 * The store list, shared by the public page (/loja) and the signed-in one
 * (/app/loja). `basePath` is where the offer links go; with a `profileId`,
 * offers the student already has (within the validity) show no buy button.
 */
export async function StoreListing({ basePath, profileId }: Readonly<{ basePath: "/loja" | "/app/loja"; profileId: string | null }>) {
  const offers = await getPrismaClient().offer.findMany({
    where: { isActive: true },
    orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      slug: true,
      name: true,
      headline: true,
      priceCents: true,
      compareAtCents: true,
      promoEndsAt: true,
      isFeatured: true,
      cardImageAssetId: true,
      grants: { select: { kind: true, durationDays: true, courseId: true, course: { select: { title: true, coverAssetId: true } } } },
    },
  }).then((rows) => rows.map((row) => withEffectivePrice(row, new Date())));
  const ownership = profileId ? await loadOfferOwnership(profileId, offers) : new Map();

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>Loja</span>
        <h1>Estude sem limites</h1>
        <p>
          Questões e simulados ilimitados, revisão espaçada dos seus erros e combos preparados para o seu concurso.
          Pagamento seguro pelo Mercado Pago (Pix, cartão ou boleto).
        </p>
        <p>
          Prefere assinar? <Link href="/assinatura">Premium mensal por {monthlyPriceLabel()}</Link>, com renovação automática — cancele quando quiser.
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
              {(offer.cardImageAssetId ?? offer.grants.find((grant) => grant.course?.coverAssetId)?.course?.coverAssetId) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className={styles.cardImage}
                  src={`/api/loja/banners/${offer.cardImageAssetId ?? offer.grants.find((grant) => grant.course?.coverAssetId)?.course?.coverAssetId}`}
                  alt=""
                  width={1200}
                  height={675}
                  loading="lazy"
                />
              ) : null}
              <h2>{offer.name}</h2>
              {offer.headline ? <p className={styles.headline}>{offer.headline}</p> : null}
              <p className={styles.includes}>
                {[
                  ...offer.grants.flatMap((grant) => (grant.kind === "COURSE" && grant.course ? [grant.course.title] : [])),
                  offer.grants.some((grant) => grant.kind === "ALL_COURSES") ? "Todos os cursos Teoria Completa" : "",
                  premiumLabel(offer.grants.find((grant) => grant.kind === "QUESTION_BANK")?.durationDays),
                ]
                  .filter(Boolean)
                  .join(" + ")}
              </p>
              <div className={styles.price}>
                {offer.compareAtCents ? <s>{formatBRL(offer.compareAtCents)}</s> : null}
                <strong>{formatBRL(offer.priceCents)}</strong>
              </div>
              {ownership.has(offer.slug) ? (
                <>
                  <p className={styles.owned}>
                    {ownership.get(offer.slug)?.admin ? "✓ Já incluído no seu acesso de administrador" : "✓ Você já tem este combo"}
                    {ownership.get(offer.slug)?.endsAt ? ` — acesso até ${ENDS.format(ownership.get(offer.slug)!.endsAt!)}` : ""}
                  </p>
                  <Link href="/app/cursos" className={styles.secondaryBuy}>
                    Ir para meus cursos
                  </Link>
                </>
              ) : (
                <Link href={`${basePath}/${offer.slug}`} className={styles.buy}>
                  Ver detalhes e comprar
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
