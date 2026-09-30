import { describe, expect, it } from "vitest";

import { formatBRL, grantPeriod, orderStatusFromPayment, parseBRL, planOffer, type OfferInput } from "./store";

describe("money", () => {
  it("parses Brazilian prices", () => {
    expect(parseBRL("39,90")).toBe(3990);
    expect(parseBRL("R$ 1.299,00")).toBe(129900);
    expect(parseBRL("39.90")).toBe(3990);
    expect(parseBRL("39")).toBe(3900);
    expect(parseBRL("1.299")).toBe(129900);
    expect(parseBRL("16.769,79")).toBe(1676979);
    expect(parseBRL("abc")).toBeNull();
    expect(parseBRL("1,2,3")).toBeNull();
  });

  it("formats cents", () => {
    expect(formatBRL(3990).replace(/\s/g, " ")).toBe("R$ 39,90");
  });
});

const base: OfferInput = {
  name: "Combo PMPE 2027",
  slug: "",
  headline: "Questões por 6 meses",
  description: "Tudo para a PMPE.",
  price: "39,90",
  compareAt: "",
  premiumDays: "180",
};

describe("planOffer", () => {
  it("builds the slug and the premium grant", () => {
    expect(planOffer(base)).toEqual({
      ok: true,
      offer: {
        name: "Combo PMPE 2027",
        slug: "combo-pmpe-2027",
        headline: "Questões por 6 meses",
        description: "Tudo para a PMPE.",
        priceCents: 3990,
        compareAtCents: null,
        promoEndsAt: null,
        grants: [{ kind: "QUESTION_BANK", durationDays: 180 }],
      },
    });
    expect(planOffer({ ...base, premiumDays: "0" })).toMatchObject({ ok: true, offer: { grants: [{ durationDays: null }] } });
  });

  it("ends the promotion at midnight after the last day (São Paulo)", () => {
    const result = planOffer({ ...base, price: "29,90", compareAt: "59,90", promoLastDay: "2026-12-31" });
    expect(result.ok && result.offer.promoEndsAt?.toISOString()).toBe("2027-01-01T03:00:00.000Z");
    expect(planOffer({ ...base, promoLastDay: "2026-12-31" })).toEqual({ ok: false, error: "PROMO_END_INVALID" });
    expect(planOffer({ ...base, compareAt: "59,90", promoLastDay: "31/12/2026" })).toEqual({ ok: false, error: "PROMO_END_INVALID" });
  });

  it("rejects bad prices, slugs and missing grants", () => {
    expect(planOffer({ ...base, price: "0,50" })).toEqual({ ok: false, error: "PRICE_INVALID" });
    expect(planOffer({ ...base, compareAt: "30,00" })).toEqual({ ok: false, error: "COMPARE_AT_INVALID" });
    expect(planOffer({ ...base, slug: "Com Espaço" })).toEqual({ ok: false, error: "SLUG_INVALID" });
    expect(planOffer({ ...base, premiumDays: "" })).toEqual({ ok: false, error: "GRANT_REQUIRED" });
  });
});

describe("grantPeriod", () => {
  const paidAt = new Date("2026-09-28T12:00:00Z");

  it("starts now, or when the current premium ends (stacking)", () => {
    expect(grantPeriod(30, paidAt, null)).toEqual({ startsAt: paidAt, endsAt: new Date("2026-10-28T12:00:00Z") });

    const currentEnd = new Date("2026-10-10T00:00:00Z");
    expect(grantPeriod(30, paidAt, currentEnd)).toEqual({ startsAt: currentEnd, endsAt: new Date("2026-11-09T00:00:00Z") });
  });

  it("lifetime purchases and lifetime owners have no end", () => {
    expect(grantPeriod(null, paidAt, null)).toEqual({ startsAt: paidAt, endsAt: null });
    expect(grantPeriod(30, paidAt, "unlimited")).toEqual({ startsAt: paidAt, endsAt: null });
  });
});

describe("orderStatusFromPayment", () => {
  it("maps Mercado Pago statuses", () => {
    expect(orderStatusFromPayment("approved")).toBe("PAID");
    expect(orderStatusFromPayment("pending")).toBe("PENDING");
    expect(orderStatusFromPayment("in_process")).toBe("PENDING");
    expect(orderStatusFromPayment("rejected")).toBe("FAILED");
    expect(orderStatusFromPayment("refunded")).toBe("REFUNDED");
    expect(orderStatusFromPayment("charged_back")).toBe("REFUNDED");
  });
});

describe("planOffer with courses", () => {
  it("course-only offers and combos", () => {
    expect(planOffer({ ...base, premiumDays: "", courseIds: ["c1", "c1"], courseDays: "365" })).toMatchObject({
      ok: true,
      offer: { grants: [{ kind: "COURSE", courseId: "c1", durationDays: 365 }] },
    });
    expect(planOffer({ ...base, courseIds: ["c1"], courseDays: "" })).toMatchObject({
      ok: true,
      offer: {
        grants: [
          { kind: "QUESTION_BANK", durationDays: 180 },
          { kind: "COURSE", courseId: "c1", durationDays: null },
        ],
      },
    });
    expect(planOffer({ ...base, premiumDays: "", courseIds: [] })).toEqual({ ok: false, error: "GRANT_REQUIRED" });
  });
});
