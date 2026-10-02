import { describe, expect, it } from "vitest";

import { describePlan } from "./plan-summary";

const base = { isAdmin: false, questionBankEnds: undefined, allCoursesEnds: undefined, subscriptionStatus: null, nextChargeAt: null, dailyFreeAnswers: 10 } as const;

describe("describePlan", () => {
  it("says free when nothing is active", () => {
    const plan = describePlan(base);

    expect(plan.tier).toBe("FREE");
    expect(plan.questions).toBe("10 por dia");
  });

  it("treats an administrator as having everything, even with no purchase", () => {
    const plan = describePlan({ ...base, isAdmin: true });

    expect(plan.tier).toBe("ADMIN");
    expect(plan.questions).toBe("Ilimitadas");
    expect(plan.courses).toBe("Todos os cursos");
  });

  it("shows the end of a Premium bought for a period", () => {
    const plan = describePlan({ ...base, questionBankEnds: new Date("2026-12-31T12:00:00Z") });

    expect(plan.tier).toBe("PREMIUM");
    expect(plan.title).toBe("Premium até 31 de dezembro de 2026");
    expect(plan.courses).toBe("Os cursos que você comprou");
  });

  it("says unlimited courses and automatic renewal for the monthly Premium", () => {
    const plan = describePlan({ ...base, questionBankEnds: new Date("2026-11-30T12:00:00Z"), allCoursesEnds: new Date("2026-11-30T12:00:00Z"), subscriptionStatus: "AUTHORIZED", nextChargeAt: new Date("2026-11-30T12:00:00Z") });

    expect(plan.courses).toBe("Todos os cursos");
    expect(plan.renewal).toBe("Automática");
    expect(plan.detail).toContain("próxima cobrança em 30 de novembro de 2026");
  });

  it("calls a Premium without end date unlimited", () => {
    expect(describePlan({ ...base, questionBankEnds: null }).title).toBe("Premium sem prazo");
  });
});
