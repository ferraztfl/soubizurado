import { normalizeTaxonomyTerm } from "@/modules/taxonomy/domain/taxonomy-term";

/*
 * Answer keys of AOCP booklets from 2016-2020: one entry per position
 * ("cargo"), each a grid of question numbers followed by the answers as one
 * run of letters:
 *
 *   NÍVEL MÉDIO ARQUIVISTA 01 02 03 ... 20 BCACCDBABDDACBDCADXC
 *   21 22 23 ... 40 DABDCXXCDBCDBADBCCAB
 *
 * Several positions share a page, headings carry noise (level, edital line,
 * "Página 2 de 4"), the last letter of a long row may be printed as its own
 * token and "X" marks an annulled question. Pure functions: the text comes
 * from pdftotext.
 */

export type GridAnswerBlock = Readonly<{
  /** Text printed before the first number row (may carry noise before the position name). */
  heading: string;
  answers: ReadonlyMap<number, string>;
}>;

const NUMBER_TOKEN = /^\d{1,3}$/;
const LETTERS_TOKEN = /^[A-EX]+$/;
const PAGE_FOOTER = /^p[aá]gina\s+\d+\s+de\s+\d+$/i;

function tokenize(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !PAGE_FOOTER.test(line))
    .flatMap((line) => line.split(/\s+/));
}

/** Whether the text looks like this grid layout (a row of numbers followed by letters). */
export function looksLikeGridAnswerKey(text: string): boolean {
  return parseAocpGridAnswerKey(text).length > 0;
}

export function parseAocpGridAnswerKey(text: string): GridAnswerBlock[] {
  const tokens = tokenize(text);
  const blocks: { heading: string; answers: Map<number, string> }[] = [];
  let current: { heading: string; answers: Map<number, string> } | null = null;
  let heading: string[] = [];
  let index = 0;

  while (index < tokens.length) {
    // A row starts with at least 5 consecutive numbers.
    let end = index;

    while (end < tokens.length && NUMBER_TOKEN.test(tokens[end]!) && (end === index || Number(tokens[end]) === Number(tokens[end - 1]) + 1)) {
      end += 1;
    }

    const count = end - index;

    if (count < 5) {
      heading.push(tokens[index]!);
      index += 1;
      continue;
    }

    const numbers = tokens.slice(index, end).map(Number);
    let letters = "";
    let cursor = end;

    while (cursor < tokens.length && letters.length < count && LETTERS_TOKEN.test(tokens[cursor]!)) {
      letters += tokens[cursor];
      cursor += 1;
    }

    if (letters.length !== count) {
      // Not a real row (e.g. a numbered list): keep the text as heading noise.
      heading.push(...tokens.slice(index, Math.max(cursor, end)));
      index = Math.max(cursor, end);
      continue;
    }

    const continues = current !== null && heading.length === 0 && numbers[0]! === Math.max(...current.answers.keys()) + 1;

    if (!continues) {
      current = { heading: heading.join(" "), answers: new Map() };
      blocks.push(current);
    }

    numbers.forEach((number, position) => current!.answers.set(number, letters[position]!));
    heading = [];
    index = cursor;
  }

  return blocks;
}

function normalize(value: string): string {
  // "prova 01" and "prova 1" are the same version.
  return normalizeTaxonomyTerm(value).replace(/\bprova 0+(\d)/g, "prova $1");
}

export type GridKeyMatch =
  | Readonly<{ ok: true; heading: string; answers: ReadonlyMap<number, string> }>
  | Readonly<{ ok: false; reason: string }>;

/**
 * Finds the block of the booklet position. `candidates` are the cover lines
 * that may name the position; `exam` is the "Prova 1..4" variant printed on
 * the cover, when there is one. A heading matches when it ends with the
 * candidate (headings carry noise before the name); a looser "contains" pass
 * only runs when nothing matched exactly.
 */
export function findGridKeyBlock(blocks: readonly GridAnswerBlock[], candidates: readonly string[], exam: number | null): GridKeyMatch {
  const wanted = [...new Set(candidates.map(normalize).filter((candidate) => candidate.length >= 4))];
  const variant = exam === null ? null : ` prova ${exam}`;

  const matchesEnd = (heading: string, candidate: string) =>
    variant
      ? heading.endsWith(`${candidate}${variant}`)
      : heading.endsWith(candidate);
  const matchesIn = (heading: string, candidate: string) =>
    variant ? heading.includes(`${candidate}${variant}`) : heading.includes(candidate);

  for (const pass of [matchesEnd, matchesIn]) {
    const hits = blocks.filter((block) => {
      const heading = normalize(block.heading);

      return wanted.some((candidate) => pass(heading, candidate));
    });

    // The same position printed twice with identical answers is not ambiguous.
    const distinct = new Map(hits.map((block) => [[...block.answers.entries()].join(","), block] as const));

    if (distinct.size === 1) {
      const block = [...distinct.values()][0]!;

      return { ok: true, heading: block.heading, answers: block.answers };
    }

    if (distinct.size > 1) {
      return { ok: false, reason: `Cargo ambíguo no gabarito (${distinct.size} blocos com respostas diferentes).` };
    }
  }

  // A key with a single position lists only "Prova 1..4": the version alone identifies it.
  if (variant) {
    const byVersion = blocks.filter((block) => normalize(block.heading).endsWith(variant));

    if (byVersion.length === 1) {
      return { ok: true, heading: byVersion[0]!.heading, answers: byVersion[0]!.answers };
    }
  }

  return { ok: false, reason: "O cargo do caderno não foi encontrado no gabarito." };
}
