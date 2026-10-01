import { normalizeTaxonomyTerm, toTaxonomySlug } from "./taxonomy-term";

/*
 * Names typed by an administrator when creating taxonomy entries from the
 * review screen. Only people create entries (never AI or importers); the
 * name is compared by its normalized term, so "Brasil Colonia" finds
 * "Brasil Colônia" instead of creating a near-duplicate.
 */

export type ManualTaxonomyLevel = "area" | "topic" | "subtopic";

export const MANUAL_TAXONOMY_NAME_MAX: Readonly<Record<ManualTaxonomyLevel, number>> = {
  area: 160,
  topic: 180,
  subtopic: 180,
};

export type ManualTaxonomyNameError = "TOO_SHORT" | "TOO_LONG" | "INVALID";

export type ManualTaxonomyName = Readonly<{ name: string; slug: string; normalized: string }>;

/** Trims and validates a typed name; an empty value returns null (level not informed). */
export function planManualTaxonomyName(
  level: ManualTaxonomyLevel,
  value: string,
): Readonly<{ ok: true; entry: ManualTaxonomyName | null }> | Readonly<{ ok: false; error: ManualTaxonomyNameError }> {
  const name = value.replace(/\s+/g, " ").trim();

  if (!name) return { ok: true, entry: null };

  const normalized = normalizeTaxonomyTerm(name);

  // Control characters and markup never belong in a taxonomy name.
  if (/[\u0000-\u001f\u007f<>]/.test(value.replace(/[\r\n\t]/g, " ")) || !normalized) return { ok: false, error: "INVALID" };
  if (normalized.length < 2) return { ok: false, error: "TOO_SHORT" };
  if (name.length > MANUAL_TAXONOMY_NAME_MAX[level]) return { ok: false, error: "TOO_LONG" };

  return { ok: true, entry: { name, slug: toTaxonomySlug(name), normalized } };
}

/** Finds an existing entry by name or alias, ignoring accents, case and punctuation. */
export function findByTaxonomyTerm<T extends Readonly<{ name: string; aliases: readonly Readonly<{ normalizedName: string }>[] }>>(
  entries: readonly T[],
  normalized: string,
): T | null {
  return (
    entries.find(
      (entry) =>
        normalizeTaxonomyTerm(entry.name) === normalized || entry.aliases.some((alias) => alias.normalizedName === normalized),
    ) ?? null
  );
}
