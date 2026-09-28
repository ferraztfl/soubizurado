import { describe, expect, it } from "vitest";

import { answerAllowance, isEntitlementActive } from "./access";

describe("answerAllowance", () => {
  it("limits visitors to 1 and free students to 10 per day", () => {
    expect(answerAllowance("visitor", 0)).toMatchObject({ limit: 1, remaining: 1, canAnswer: true });
    expect(answerAllowance("visitor", 1)).toMatchObject({ remaining: 0, canAnswer: false });
    expect(answerAllowance("free", 9)).toMatchObject({ limit: 10, remaining: 1, canAnswer: true });
    expect(answerAllowance("free", 12)).toMatchObject({ remaining: 0, canAnswer: false });
  });

  it("premium is unlimited", () => {
    expect(answerAllowance("premium", 500)).toMatchObject({ limit: null, remaining: null, canAnswer: true });
  });
});

describe("isEntitlementActive", () => {
  const now = new Date("2026-09-28T12:00:00Z");

  it("respects start, end and revocation", () => {
    expect(isEntitlementActive({ startsAt: new Date("2026-09-01"), endsAt: null, revokedAt: null }, now)).toBe(true);
    expect(isEntitlementActive({ startsAt: new Date("2026-10-01"), endsAt: null, revokedAt: null }, now)).toBe(false);
    expect(isEntitlementActive({ startsAt: new Date("2026-09-01"), endsAt: new Date("2026-09-28T11:00:00Z"), revokedAt: null }, now)).toBe(false);
    expect(isEntitlementActive({ startsAt: new Date("2026-09-01"), endsAt: null, revokedAt: new Date("2026-09-20") }, now)).toBe(false);
  });
});
