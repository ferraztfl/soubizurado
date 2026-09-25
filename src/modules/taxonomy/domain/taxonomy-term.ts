/**
 * Canonical form used to compare taxonomy names and aliases.
 *
 * Accents, case, punctuation and ordinal markers are ignored so that
 * "Função do 1º Grau" and "funcao do 1 grau" compare equal. Wording
 * differences ("primeiro" vs "1") are intentionally NOT folded here;
 * they are expressed as explicit aliases.
 */
export function normalizeTaxonomyTerm(
  value: string,
): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("pt-BR")
    // NFKD already turned º/ª into o/a; only fold them when glued to
    // the number so "de 2 a 3" keeps its "a".
    .replace(/(\d)(?:\s*°|[oa])(?![a-z0-9])/g, "$1")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function toTaxonomySlug(
  value: string,
): string {
  return normalizeTaxonomyTerm(value).replace(
    / /g,
    "-",
  );
}
