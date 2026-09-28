import { describe, expect, it } from "vitest";

import { planChipLabel, planUsageText } from "./student-plan";

describe("plan texts", () => {
  it("says what is left, never a bare 0/1", () => {
    expect(planChipLabel({ premium: false, visitor: true, remaining: 1, limit: 1 })).toBe("Visitante · 1 resposta restante hoje");
    expect(planChipLabel({ premium: false, visitor: true, remaining: 0, limit: 1 })).toBe("Visitante · limite de hoje atingido");
    expect(planChipLabel({ premium: false, remaining: 7, limit: 10 })).toBe("Grátis · 7 respostas restantes hoje");
    expect(planChipLabel({ premium: true, remaining: null, limit: null })).toBe("Premium");
  });

  it("explains the daily limit in the sidebar", () => {
    expect(planUsageText({ premium: false, visitor: true, remaining: 0, limit: 1 })).toContain("já usou a resposta grátis de hoje");
    expect(planUsageText({ premium: false, remaining: 3, limit: 10 })).toBe("Restam 3 de 10 respostas grátis hoje.");
    expect(planUsageText({ premium: false, remaining: 0, limit: 10 })).toContain("usou as 10 respostas grátis de hoje");
  });
});
