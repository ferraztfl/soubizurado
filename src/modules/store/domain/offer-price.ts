/*
 * Price actually charged for an offer at a given moment. A promotion with an
 * end date really ends: afterwards the regular price (compare_at) applies,
 * on every page and at checkout. No fake countdowns.
 */

export type OfferPrice = Readonly<{ priceCents: number; compareAtCents: number | null; promoActive: boolean }>;

/**
 * Price actually charged now: the promotional price until promoEndsAt, then the
 * regular price (compareAt). Used by the store pages and the checkout alike.
 */
export function effectiveOfferPrice(
  offer: Readonly<{ priceCents: number; compareAtCents: number | null; promoEndsAt: Date | null }>,
  now: Date,
): OfferPrice {
  if (offer.promoEndsAt && offer.compareAtCents !== null && now.getTime() >= offer.promoEndsAt.getTime()) {
    return { priceCents: offer.compareAtCents, compareAtCents: null, promoActive: false };
  }
  return { priceCents: offer.priceCents, compareAtCents: offer.compareAtCents, promoActive: offer.promoEndsAt !== null };
}

/** The offer with its price fields replaced by the ones valid now (for the store pages). */
export function withEffectivePrice<T extends Readonly<{ priceCents: number; compareAtCents: number | null; promoEndsAt: Date | null }>>(
  offer: T,
  now: Date,
): T & Readonly<{ promoActive: boolean }> {
  return { ...offer, ...effectiveOfferPrice(offer, now) };
}
