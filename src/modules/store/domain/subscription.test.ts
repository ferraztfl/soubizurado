import { describe, expect, it } from "vitest";

import {
  addMonths,
  chargeStatusFromPayment,
  monthlyEquivalentCents,
  monthlyPriceLabel,
  pricePerDayCents,
  subscriptionPeriod,
  subscriptionStatusFromProvider,
} from "./subscription";

describe("subscription", () => {
  it("maps provider statuses", () => {
    expect(subscriptionStatusFromProvider("authorized")).toBe("AUTHORIZED");
    expect(subscriptionStatusFromProvider("cancelled")).toBe("CANCELLED");
    expect(subscriptionStatusFromProvider("paused")).toBe("PAUSED");
    expect(subscriptionStatusFromProvider("whatever")).toBe("PENDING");
    expect(chargeStatusFromPayment("approved")).toBe("PAID");
    expect(chargeStatusFromPayment("charged_back")).toBe("REFUNDED");
    expect(chargeStatusFromPayment("rejected")).toBe("FAILED");
    expect(chargeStatusFromPayment(null)).toBe("PENDING");
  });

  it("adds calendar months with clamping", () => {
    expect(addMonths(new Date("2027-01-31T12:00:00Z"), 1).toISOString()).toBe("2027-02-28T12:00:00.000Z");
    expect(addMonths(new Date("2028-01-31T12:00:00Z"), 1).toISOString()).toBe("2028-02-29T12:00:00.000Z");
    expect(addMonths(new Date("2026-12-15T00:00:00Z"), 1).toISOString()).toBe("2027-01-15T00:00:00.000Z");
  });

  it("gives one month plus grace per charge", () => {
    const period = subscriptionPeriod("PREMIUM_MONTHLY", new Date("2026-10-01T10:00:00Z"));
    expect(period.startsAt.toISOString()).toBe("2026-10-01T10:00:00.000Z");
    expect(period.endsAt.toISOString()).toBe("2026-11-04T10:00:00.000Z");
  });

  it("prices per day", () => {
    expect(pricePerDayCents("PREMIUM_MONTHLY")).toBe(50);
    expect(monthlyPriceLabel()).toBe("R$ 14,90/mês");
    expect(monthlyEquivalentCents(11_880)).toBe(990);
  });
});
