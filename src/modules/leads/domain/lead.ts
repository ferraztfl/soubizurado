/*
 * Leads: people who ask for a free material (the edital verticalizado PDF)
 * leaving name, e-mail and WhatsApp. The material is delivered with or
 * without marketing consent (LGPD: consent is free and separate). Pure functions.
 */

export type LeadInput = Readonly<{ name: string; email: string; whatsapp: string; marketingConsent: boolean }>;

export type LeadError = "NAME_INVALID" | "EMAIL_INVALID" | "WHATSAPP_INVALID";

export type LeadPlan = Readonly<{ name: string; email: string; whatsapp: string; marketingConsent: boolean }>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Valid Brazilian area codes (DDD). */
const AREA_CODES = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/**
 * "(81) 9 9999-0000", "+55 81 99999-0000" → "81999990000". Brazilian mobile
 * numbers only (11 digits with DDD, starting with 9); null when invalid.
 */
export function normalizeWhatsapp(value: string): string | null {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length === 12 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length !== 11 || digits[2] !== "9") return null;
  if (!AREA_CODES.has(Number(digits.slice(0, 2)))) return null;
  // Rejects obvious fillers like 81999999999.
  if (/^(\d)\1+$/.test(digits.slice(2))) return null;
  return digits;
}

/** "81999990000" → "(81) 99999-0000". */
export function formatWhatsapp(digits: string): string {
  return digits.length === 11 ? `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}` : digits;
}

export function planLead(input: LeadInput): { ok: true; lead: LeadPlan } | { ok: false; error: LeadError } {
  const name = input.name.replace(/\s+/g, " ").trim();
  // A real name: two words, letters only (accents, hyphen and apostrophe allowed).
  if (name.length < 5 || name.length > 120 || !/^\p{L}[\p{L}'’.-]*(\s+\p{L}[\p{L}'’.-]*)+$/u.test(name)) return { ok: false, error: "NAME_INVALID" };

  const email = input.email.trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) return { ok: false, error: "EMAIL_INVALID" };

  const whatsapp = normalizeWhatsapp(input.whatsapp);
  if (!whatsapp) return { ok: false, error: "WHATSAPP_INVALID" };

  return { ok: true, lead: { name, email, whatsapp, marketingConsent: input.marketingConsent } };
}

/** New requests allowed from the same network per hour (abuse limit). */
export const LEADS_PER_HOUR = 8;

/** CSV cell (RFC 4180), also neutralizing spreadsheet formulas typed by a visitor. */
export function csvCell(value: string | number | boolean | null): string {
  const text = value === null ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",;\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
