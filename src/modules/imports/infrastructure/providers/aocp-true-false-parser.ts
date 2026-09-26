import { normalizeTaxonomyTerm } from "@/modules/taxonomy/domain/taxonomy-term";

import type { AocpLine } from "./aocp-pdf-parser";

/*
 * Instituto AOCP booklets in the "julgue como VERDADEIRO ou FALSO"
 * format (e.g. UFBA 2016): numbered items run inside two columns, a bold
 * group command ("Em relação ao Texto 1, julgue ... os itens a seguir.")
 * precedes each group, shared texts start with a bold "Texto N – itens
 * X a Y" header and section headings are bold spaced capitals
 * ("A D M I N I S T R A Ç Ã O  P Ú B L I C A").
 *
 * The answer key PDF lists every role of the contest: role name, a row
 * of item numbers and a row of V/F letters (X = annulled).
 *
 * Pure functions only; no file system, no database.
 */

export type TrueFalseItem = Readonly<{
  number: number;
  section: string | null;
  /** Group command shown before the item ("Em relação ao Texto 1, julgue..."). */
  command: string | null;
  statement: string;
  images: readonly string[];
  supportText: string | null;
  supportImages: readonly string[];
  refersToHighlight: boolean;
  page: number;
}>;

export type TrueFalseExam = Readonly<{
  sections: readonly string[];
  items: readonly TrueFalseItem[];
}>;

export type SectionRange = Readonly<{ name: string; from: number; to: number }>;

export type TrueFalseAnswer = "V" | "F" | "ANNULLED";

export const TRUE_FALSE_FORMAT = /julgue[\s\S]{0,60}verdadeiro\s+ou\s+falso/i;

const ITEM_START = /^(\d{1,3})\.\s+(.*)$/;
const SUPPORT_HEADER = /^texto\s+\d+\s*[–-]\s*itens?\s+(\d{1,3})\s*(?:a|e|-|–)\s*(\d{1,3})/i;
const HIGHLIGHT = /em destaque|sublinhad|grifad|destacad/i;
/** Items start at the column edge; continuation lines are indented. */
const ITEM_EDGE_TOLERANCE = 12;

const RANGE = /\b(\d{1,3})\s+a\s+(\d{1,3})\b/;

/**
 * Cover "COMPOSIÇÃO DO CADERNO": each "NN a NN" range belongs to the
 * nearest preceding text line ("Português", "Administração Pública").
 */
export function parseSectionRanges(coverText: string): SectionRange[] {
  const ranges: SectionRange[] = [];
  let lastName: string | null = null;

  for (const raw of coverText.split("\n")) {
    const line = raw.replace(/composi[cç][aã]o\s+do\s+caderno/gi, " ").replace(/\s+/g, " ").trim();

    if (!line) {
      continue;
    }

    const range = line.match(RANGE);

    if (range) {
      const inline = line.slice(0, range.index).trim();
      const name = inline.length >= 3 ? inline : lastName;

      if (name) {
        ranges.push({ name, from: Number(range[1]), to: Number(range[2]) });
      }

      lastName = null;
      continue;
    }

    // Candidate names are short text lines, not instructions.
    lastName = line.length <= 60 && /^[A-ZÀ-Ý]/.test(line) && !/[.:;]$/.test(line) ? line : null;
  }

  return ranges.sort((left, right) => left.from - right.from);
}

/** Words that usually open a group command. */
const COMMAND_OPENER =
  /^(em rela[cç][aã]o|considerando|com base|utilizando|acerca|sobre|de acordo|a respeito|analise|quanto|no que|tendo em vista|segundo|conforme|nos termos|julgue)\b/i;

/** A bold line that opens a group command rather than a text title. */
const COMMAND_START = new RegExp(`julgue|${COMMAND_OPENER.source}`, "i");

function sectionFor(ranges: readonly SectionRange[], number: number): string | null {
  return ranges.find((range) => number >= range.from && number <= range.to)?.name ?? null;
}

/** Bold spaced capitals ("A D M I N I S T R A Ç Ã O") or a plain capitalised heading. */
function headingName(line: AocpLine, ranges: readonly SectionRange[]): string | null {
  const compact = line.text.replace(/\s+/g, "");

  if (compact.length < 5 || compact !== compact.toLocaleUpperCase("pt-BR") || /\d/.test(compact)) {
    return null;
  }

  const normalized = normalizeTaxonomyTerm(compact).replace(/\s+/g, "");
  const known = ranges.find(
    (range) => normalizeTaxonomyTerm(range.name).replace(/\s+/g, "") === normalized,
  );

  return known?.name ?? null;
}

function appendText(current: string, next: string): string {
  if (!current) {
    return next;
  }

  // Hyphenated line break: "cartacapi-" + "tal.com.br".
  if (/[A-Za-zÀ-ÿ]-$/.test(current)) {
    return `${current.slice(0, -1)}${next}`;
  }

  return `${current} ${next}`;
}

type Support = { text: string; images: string[]; from: number; to: number };
type MutableItem = {
  number: number;
  section: string | null;
  command: string | null;
  statement: string;
  images: string[];
  page: number;
};

export function parseAocpTrueFalseExam(
  lines: readonly AocpLine[],
  ranges: readonly SectionRange[],
): TrueFalseExam {
  const items: MutableItem[] = [];
  const supports: Support[] = [];

  let state: "none" | "support" | "command" | "item" = "none";
  let support: Support | null = null;
  let command = "";
  let activeCommand: string | null = null;
  let item: MutableItem | null = null;

  // A command block mentions "julgue" within its first few bold lines;
  // support texts may also be set in bold, so the look-ahead tells them
  // apart ("Segundo o autor..." inside a text is not a command).
  const opensCommand = (index: number): boolean => {
    const block: string[] = [];

    for (let next = index; next < lines.length && block.length < 6; next += 1) {
      const candidate = lines[next]!;

      // Another opener starts a different block ("Segundo o autor..."
      // in the text, then "Em relação ao Texto 1, julgue...").
      if (
        candidate.image ||
        !candidate.bold ||
        ITEM_START.test(candidate.text) ||
        (next > index && COMMAND_OPENER.test(candidate.text))
      ) {
        break;
      }

      block.push(candidate.text);
    }

    return COMMAND_START.test(lines[index]!.text) && /julgue/i.test(block.join(" "));
  };

  const appendSupport = (target: Support, line: AocpLine) => {
    // First-line indent starts a new paragraph.
    const indented = line.left - line.columnLeft > 15;

    if (!target.text) {
      target.text = line.text;
    } else if (indented) {
      target.text = `${target.text}\n\n${line.text}`;
    } else {
      target.text = appendText(target.text, line.text);
    }
  };

  for (const [index, line] of lines.entries()) {
    if (line.page < 2) {
      continue;
    }

    if (line.image) {
      if (state === "item" && item) {
        item.images.push(line.image);
      } else if (support) {
        support.images.push(line.image);
      }

      continue;
    }

    if (line.bold) {
      if (headingName(line, ranges)) {
        state = "none";
        support = null;
        activeCommand = null;
        item = null;
        continue;
      }

      const header = line.text.match(SUPPORT_HEADER);

      if (header) {
        support = { text: "", images: [], from: Number(header[1]), to: Number(header[2]) };
        supports.push(support);
        state = "support";
        item = null;
        continue;
      }

      // Inside a shared text, bold lines are its title or emphasis unless
      // they look like a group command.
      if (state === "support" && support && !opensCommand(index)) {
        appendSupport(support, line);
        continue;
      }

      if (state !== "command") {
        command = "";
        state = "command";
        item = null;
      }

      command = appendText(command, line.text);
      activeCommand = command;
      continue;
    }

    const start = line.text.match(ITEM_START);
    const expected = (items[items.length - 1]?.number ?? 0) + 1;

    if (start && Number(start[1]) === expected && line.left - line.columnLeft < ITEM_EDGE_TOLERANCE) {
      item = {
        number: expected,
        section: sectionFor(ranges, expected),
        command: activeCommand,
        statement: start[2]!.trim(),
        images: [],
        page: line.page,
      };
      items.push(item);
      state = "item";
      continue;
    }

    if (state === "item" && item) {
      item.statement = appendText(item.statement, line.text);
    } else if (state === "support" && support) {
      appendSupport(support, line);
    } else if (state === "command") {
      // Unbolded tail of a command: keep it with the command.
      command = appendText(command, line.text);
      activeCommand = command;
    }
  }

  return {
    sections: ranges.map((range) => range.name),
    items: items.map((entry) => {
      const shared = supports.find((candidate) => entry.number >= candidate.from && entry.number <= candidate.to);

      return {
        ...entry,
        supportText: shared?.text.trim() || null,
        supportImages: shared?.images ?? [],
        refersToHighlight: HIGHLIGHT.test(entry.statement),
      };
    }),
  };
}

/** Structural problems that must block the import. */
export function validateTrueFalseExam(exam: TrueFalseExam, expectedItems: number | null): string[] {
  const issues: string[] = [];

  if (exam.items.length === 0) {
    issues.push("Nenhum item de Verdadeiro/Falso encontrado no caderno.");
  }

  if (expectedItems !== null && exam.items.length !== expectedItems) {
    issues.push(`O caderno anuncia ${expectedItems} itens, mas foram lidos ${exam.items.length}.`);
  }

  for (const entry of exam.items) {
    if (entry.statement.length < 15) {
      issues.push(`Item ${entry.number}: texto curto demais ("${entry.statement}").`);
    }

    if (!entry.command) {
      issues.push(`Item ${entry.number}: comando "julgue..." do grupo não identificado.`);
    }
  }

  return issues;
}

type KeyBlock = { heading: string; answers: Map<number, TrueFalseAnswer> };

/**
 * Reads every role block of a V/F answer key: heading words, then
 * alternating rows of item numbers and V/F/X letters (irregular spaces).
 */
export function parseTrueFalseAnswerKeyBlocks(text: string): KeyBlock[] {
  const tokens = text
    .split(/\n/)
    .filter((line) => !/pcimarkpci|pciconcursos/i.test(line))
    .join(" ")
    .split(/\s+/)
    .filter(Boolean);

  const blocks: KeyBlock[] = [];
  let headingWords: string[] = [];
  let current: KeyBlock | null = null;
  let pendingNumbers: number[] = [];
  let letters = "";

  const flush = () => {
    if (current && pendingNumbers.length > 0) {
      pendingNumbers.forEach((number, index) => {
        const letter = letters[index];

        if (letter) {
          current!.answers.set(number, letter === "X" ? "ANNULLED" : (letter as "V" | "F"));
        }
      });
    }

    pendingNumbers = [];
    letters = "";
  };

  for (const token of tokens) {
    if (/^\d{1,3}$/.test(token)) {
      if (letters) {
        flush();
      }

      if (!current || headingWords.length > 0) {
        flush();
        current = { heading: headingWords.join(" "), answers: new Map() };
        blocks.push(current);
        headingWords = [];
      }

      pendingNumbers.push(Number(token));
      continue;
    }

    if (/^[VFX]+$/.test(token) && pendingNumbers.length > 0) {
      letters += token;
      continue;
    }

    flush();
    headingWords.push(token);
  }

  flush();

  return blocks.filter((block) => block.answers.size > 0);
}

/**
 * Picks the block of one role. The role heading may carry a prefix
 * ("NÍVEL SUPERIOR – CLASSE E - TARDE ADMINISTRADOR"), so the heading
 * must END with the role name. Null when zero or several blocks match.
 */
export function findRoleAnswers(
  blocks: readonly KeyBlock[],
  role: string,
): Readonly<{ answers: ReadonlyMap<number, TrueFalseAnswer> | null; matches: readonly string[] }> {
  const wanted = normalizeTaxonomyTerm(role);
  const matching = blocks.filter((block) => {
    const heading = normalizeTaxonomyTerm(block.heading);
    return heading === wanted || heading.endsWith(` ${wanted}`);
  });

  return {
    answers: matching.length === 1 ? matching[0]!.answers : null,
    matches: matching.map((block) => block.heading),
  };
}
