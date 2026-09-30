import { describe, expect, it } from "vitest";

import { effectiveOfferPrice } from "./offer-price";

describe("offer price", () => {
  it("ends the promotional price at the promo date", () => {
    const offer = { priceCents: 2990, compareAtCents: 5990, promoEndsAt: new Date("2027-01-01T03:00:00Z") };
    expect(effectiveOfferPrice(offer, new Date("2026-12-31T23:00:00Z"))).toEqual({ priceCents: 2990, compareAtCents: 5990, promoActive: true });
    expect(effectiveOfferPrice(offer, new Date("2027-01-01T03:00:00Z"))).toEqual({ priceCents: 5990, compareAtCents: null, promoActive: false });
    expect(effectiveOfferPrice({ ...offer, promoEndsAt: null }, new Date())).toEqual({ priceCents: 2990, compareAtCents: 5990, promoActive: false });
  });
});
