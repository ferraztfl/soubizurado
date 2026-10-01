import { describe, expect, it } from "vitest";

import { csvCell, formatWhatsapp, normalizeWhatsapp, planLead } from "./lead";

describe("leads", () => {
  it("normalizes Brazilian mobile numbers", () => {
    expect(normalizeWhatsapp("(81) 9 9876-5432")).toBe("81998765432");
    expect(normalizeWhatsapp("+55 81 99876-5432")).toBe("81998765432");
    expect(normalizeWhatsapp("081998765432")).toBe("81998765432");
    expect(formatWhatsapp("81998765432")).toBe("(81) 99876-5432");
  });

  it("rejects landlines, bad area codes and fillers", () => {
    expect(normalizeWhatsapp("(81) 3333-4444")).toBeNull();
    expect(normalizeWhatsapp("(20) 99876-5432")).toBeNull();
    expect(normalizeWhatsapp("(81) 99999-9999")).toBeNull();
    expect(normalizeWhatsapp("abc")).toBeNull();
  });

  it("plans a lead, with or without marketing consent", () => {
    expect(planLead({ name: "  maria   da Silva ", email: " Maria@Exemplo.COM ", whatsapp: "81 99876-5432", marketingConsent: false })).toEqual({
      ok: true,
      lead: { name: "maria da Silva", email: "maria@exemplo.com", whatsapp: "81998765432", marketingConsent: false },
    });
    expect(planLead({ name: "Maria", email: "m@e.com", whatsapp: "81998765432", marketingConsent: true })).toEqual({ ok: false, error: "NAME_INVALID" });
    expect(planLead({ name: "Maria Silva", email: "sem-arroba", whatsapp: "81998765432", marketingConsent: true })).toEqual({ ok: false, error: "EMAIL_INVALID" });
    expect(planLead({ name: "Maria Silva", email: "m@e.com", whatsapp: "123", marketingConsent: true })).toEqual({ ok: false, error: "WHATSAPP_INVALID" });
  });

  it("escapes CSV cells and neutralizes formulas", () => {
    expect(csvCell("Maria; Silva")).toBe('"Maria; Silva"');
    expect(csvCell('diz "oi"')).toBe('"diz ""oi"""');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(null)).toBe("");
    expect(csvCell(true)).toBe("true");
  });
});
