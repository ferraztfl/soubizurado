/*
 * Store rules: money in cents (BRL), offer validation, what a paid order
 * grants, and how Mercado Pago payment statuses map to order statuses.
 * Pure functions; persistence and the payment provider live elsewhere.
 */

const DAY_MS = 86_400_000;

export function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

/** "39,90", "39.90", "R$ 1.299,00", "39" → cents; null when invalid. */
export function parseBRL(value: string): number | null {
  const cleaned = value.replace(/R\$|\s/g, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+([,.]\d{1,2})?$/.test(cleaned)) return null;

  // "1.299" (no comma, groups of three) is one thousand two hundred and ninety-nine reais.
  const thousandsOnly = /^\d{1,3}(\.\d{3})+$/.test(cleaned);
  const normalized =
    cleaned.includes(",") || thousandsOnly ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const cents = Math.round(Number(normalized) * 100);

  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
}

export type OfferGrantInput =
  | Readonly<{ kind: "QUESTION_BANK"; durationDays: number | null }>
  | Readonly<{ kind: "COURSE"; courseId: string; durationDays: number | null }>;

export type OfferInput = Readonly<{
  name: string;
  slug: string;
  headline: string;
  description: string;
  price: string;
  compareAt: string;
  premiumDays: string;
  /** Courses the offer gives access to (member area). */
  courseIds?: readonly string[];
  /** Course access in days; "0" or blank = no end date. */
  courseDays?: string;
}>;

export type OfferError =
  | "NAME_REQUIRED"
  | "SLUG_INVALID"
  | "PRICE_INVALID"
  | "COMPARE_AT_INVALID"
  | "GRANT_REQUIRED"
  | "TEXT_TOO_LONG";

export type OfferPlan = Readonly<{
  name: string;
  slug: string;
  headline: string | null;
  description: string;
  priceCents: number;
  compareAtCents: number | null;
  grants: readonly OfferGrantInput[];
}>;

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MIN_PRICE_CENTS = 100;

export function slugifyOffer(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function planOffer(input: OfferInput): { ok: true; offer: OfferPlan } | { ok: false; error: OfferError } {
  const name = input.name.replace(/\s+/g, " ").trim();
  const slug = (input.slug.trim() || slugifyOffer(name)).toLowerCase();
  const headline = input.headline.replace(/\s+/g, " ").trim();
  const description = input.description.replace(/\r\n/g, "\n").trim();
  const priceCents = parseBRL(input.price);
  const compareAtCents = input.compareAt.trim() ? parseBRL(input.compareAt) : null;
  const premiumDays = input.premiumDays.trim();

  if (name.length < 3 || name.length > 160) return { ok: false, error: "NAME_REQUIRED" };
  if (!SLUG.test(slug) || slug.length > 120) return { ok: false, error: "SLUG_INVALID" };
  if (headline.length > 240 || description.length > 20_000) return { ok: false, error: "TEXT_TOO_LONG" };
  if (priceCents === null || priceCents < MIN_PRICE_CENTS) return { ok: false, error: "PRICE_INVALID" };
  if (input.compareAt.trim() && (compareAtCents === null || compareAtCents <= priceCents)) {
    return { ok: false, error: "COMPARE_AT_INVALID" };
  }

  // Days: "0" = no end date. Premium blank = the offer grants no premium
  // (a course-only offer); at least one grant is required.
  const parseDays = (value: string) => {
    const days = Number(value);
    return Number.isSafeInteger(days) && days >= 0 && days <= 3660 ? (days === 0 ? null : days) : undefined;
  };

  const grants: OfferGrantInput[] = [];

  if (premiumDays !== "") {
    const days = parseDays(premiumDays);
    if (days === undefined) return { ok: false, error: "GRANT_REQUIRED" };
    grants.push({ kind: "QUESTION_BANK", durationDays: days });
  }

  const courseIds = [...new Set(input.courseIds ?? [])];
  if (courseIds.length > 0) {
    const days = parseDays((input.courseDays ?? "").trim() || "0");
    if (days === undefined) return { ok: false, error: "GRANT_REQUIRED" };
    grants.push(...courseIds.map((courseId) => ({ kind: "COURSE" as const, courseId, durationDays: days })));
  }

  if (grants.length === 0) return { ok: false, error: "GRANT_REQUIRED" };

  return {
    ok: true,
    offer: {
      name,
      slug,
      headline: headline || null,
      description,
      priceCents,
      compareAtCents,
      grants,
    },
  };
}

/**
 * Period granted by a paid order. Premium stacks: a purchase made while
 * premium is still active starts when the current period ends.
 */
export function grantPeriod(
  durationDays: number | null,
  paidAt: Date,
  currentEnd: Date | null | "unlimited",
): { startsAt: Date; endsAt: Date | null } {
  if (currentEnd === "unlimited" || durationDays === null) {
    return { startsAt: paidAt, endsAt: null };
  }

  const startsAt = currentEnd && currentEnd > paidAt ? currentEnd : paidAt;
  return { startsAt, endsAt: new Date(startsAt.getTime() + durationDays * DAY_MS) };
}

export type OrderStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED";

/** Mercado Pago payment.status → our order status. */
export function orderStatusFromPayment(status: string): OrderStatus {
  switch (status) {
    case "approved":
      return "PAID";
    case "refunded":
    case "charged_back":
      return "REFUNDED";
    case "cancelled":
      return "CANCELLED";
    case "rejected":
      return "FAILED";
    default:
      // pending, in_process, authorized, in_mediation
      return "PENDING";
  }
}
