/*
 * Parser for Instituto AOCP exam booklets ("Caderno de Questões")
 * converted with `pdftohtml -xml`, plus their official answer keys.
 *
 * Layout facts (validated on SEJUSP-MG 2025, Policial Penal, Tipo 01):
 * - page 1 is the cover; header/footer lines repeat on every page;
 * - two text columns split at half the page width;
 * - section headings: bold, largest body font (e.g. "Língua Portuguesa");
 * - question marker: bold line containing only the number;
 * - statement: every line after the marker until "(A)";
 * - alternatives: "(A)".."(E)" labels, content indented to the right;
 * - support texts: text aligned to the column margin that appears
 *   outside a question; it applies to the following questions of the
 *   same section until another support text or section starts;
 * - "Redação" sections end the objective part;
 * - images (pdftohtml `<image>`) follow the same reading order: inside
 *   a statement they belong to the question, indented inside an
 *   alternative to that alternative, otherwise to the support text.
 *   Tiny images and images repeated at the same spot on several pages
 *   (logos) are dropped.
 *
 * Pure functions only; no file system, no database.
 */

export type AocpLine = Readonly<{
  page: number;
  top: number;
  left: number;
  size: number;
  bold: boolean;
  text: string;
  column: 0 | 1;
  columnLeft: number;
  /** Extracted image file name (relative to the pdftohtml output). */
  image: string | null;
}>;

export type AocpAlternative = Readonly<{
  label: string;
  content: string;
  images: readonly string[];
}>;

export type AocpQuestion = Readonly<{
  number: number;
  /**
   * 0-based occurrence of this number. Optional-language blocks reuse
   * numbers (e.g. 11-15 in English and again in Spanish).
   */
  variant: number;
  /** Top-level grouping such as "BLOCO I", when the booklet has one. */
  block: string | null;
  /**
   * The statement refers to a highlighted/underlined term. Underlines
   * are drawn shapes that pdftohtml cannot export, so a reviewer must
   * check the highlight against the original PDF.
   */
  refersToHighlight: boolean;
  section: string | null;
  statement: string;
  /** Images placed inside the statement. */
  images: readonly string[];
  alternatives: readonly AocpAlternative[];
  supportText: string | null;
  /** Images that belong to the support text shared with this question. */
  supportImages: readonly string[];
  page: number;
}>;

export type AocpExam = Readonly<{
  sections: readonly string[];
  questions: readonly AocpQuestion[];
}>;

export type AocpAnswer = string | "ANNULLED";

/** Answers per question number, in booklet order (one per variant). */
export type AocpAnswerKey = ReadonlyMap<number, readonly AocpAnswer[]>;

export function answerFor(
  key: AocpAnswerKey,
  question: Pick<AocpQuestion, "number" | "variant">,
): AocpAnswer | null {
  return key.get(question.number)?.[question.variant] ?? null;
}

const HEADER_MAX_TOP = 75;
const MIN_IMAGE_SIDE = 24;
const REPEATED_IMAGE_PAGES = 3;
const FOOTER_MIN_RATIO = 0.93;
const SAME_LINE_TOLERANCE = 4;
const ALTERNATIVE_LABEL = /^\(([A-E])\)\s*(.*)$/;
const QUESTION_NUMBER = /^\d{1,3}$/;
const END_OF_OBJECTIVE_PART = /reda[cç][aã]o/i;
const BLOCK_HEADING = /^bloco\b/i;
const HIGHLIGHT_REFERENCE =
  /\b(destacad[oa]s?|em destaque|sublinhad[oa]s?|grifad[oa]s?|em negrito)\b/i;

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function cleanText(raw: string): string {
  // Italic spans become _word_ (rendered by RichText); other tags drop.
  const withItalics = raw.replace(
    /<i>([\s\S]*?)<\/i>/g,
    (_, inner: string) => {
      const text = inner.replace(/<[^>]+>/g, "").trim();
      return /\p{L}/u.test(text) ? ` _${text}_ ` : inner;
    },
  );

  return decodeEntities(withItalics.replace(/<[^>]+>/g, ""))
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Reads positioned lines in reading order (column by column). */
export function readAocpLines(xml: string): AocpLine[] {
  const fontSizes = new Map<string, number>();

  for (const match of xml.matchAll(/<fontspec id="(\d+)" size="(-?\d+)"/g)) {
    fontSizes.set(match[1]!, Number(match[2]));
  }

  const lines: AocpLine[] = [];

  for (const page of xml.matchAll(
    /<page number="(\d+)"[^>]*height="(\d+)" width="(\d+)">([\s\S]*?)<\/page>/g,
  )) {
    const pageNumber = Number(page[1]);
    const height = Number(page[2]);
    const width = Number(page[3]);

    if (pageNumber === 1) {
      continue;
    }

    const pageLines: AocpLine[] = [];

    for (const text of page[4]!.matchAll(
      /<text top="(\d+)" left="(\d+)" width="\d+" height="\d+" font="(\d+)">([\s\S]*?)<\/text>/g,
    )) {
      const top = Number(text[1]);
      const left = Number(text[2]);
      const content = cleanText(text[4]!);

      if (!content || top < HEADER_MAX_TOP || top > height * FOOTER_MIN_RATIO) {
        continue;
      }

      const column: 0 | 1 = left < width / 2 ? 0 : 1;

      pageLines.push({
        page: pageNumber,
        top,
        left,
        size: fontSizes.get(text[3]!) ?? 0,
        bold: /<b>/.test(text[4]!),
        text: content,
        column,
        columnLeft: 0,
        image: null,
      });
    }

    for (const image of page[4]!.matchAll(
      /<image top="(\d+)" left="(\d+)" width="(\d+)" height="(\d+)" src="([^"]+)"/g,
    )) {
      const top = Number(image[1]);
      const left = Number(image[2]);
      const imageWidth = Number(image[3]);
      const imageHeight = Number(image[4]);

      if (
        imageWidth < MIN_IMAGE_SIDE ||
        imageHeight < MIN_IMAGE_SIDE ||
        top > height * FOOTER_MIN_RATIO
      ) {
        continue;
      }

      pageLines.push({
        page: pageNumber,
        top,
        left,
        size: 0,
        bold: false,
        text: "",
        column: left < width / 2 ? 0 : 1,
        columnLeft: 0,
        image: decodeEntities(image[5]!),
        imageBox: `${Math.round(left / 4)}:${Math.round(top / 4)}:${imageWidth}:${imageHeight}`,
      } as AocpLine & { imageBox: string });
    }

    // Column margin = smallest left offset used in that column.
    const margins = [0, 1].map((column) =>
      Math.min(
        ...pageLines
          .filter((line) => line.column === column && !line.image)
          .map((line) => line.left),
      ),
    );

    // Group fragments into visual rows first: a label like "(A)" can sit
    // 1-2px below the first words of its own content.
    pageLines.sort((a, b) => a.column - b.column || a.top - b.top);

    const rows: AocpLine[][] = [];

    for (const line of pageLines) {
      const row = rows[rows.length - 1];
      const anchor = row?.[0];

      if (
        anchor &&
        anchor.column === line.column &&
        line.top - anchor.top <= SAME_LINE_TOLERANCE
      ) {
        row.push(line);
      } else {
        rows.push([line]);
      }
    }

    const ordered = rows.flatMap((row) =>
      [...row].sort((a, b) => a.left - b.left),
    );

    // Merge fragments printed on the same visual line.
    for (const line of ordered) {
      const previous = lines[lines.length - 1];
      const withMargin = { ...line, columnLeft: margins[line.column]! };

      if (
        !line.image &&
        previous &&
        !previous.image &&
        previous.page === line.page &&
        previous.column === line.column &&
        Math.abs(previous.top - line.top) <= SAME_LINE_TOLERANCE &&
        line.left > previous.left
      ) {
        lines[lines.length - 1] = {
          ...previous,
          text: joinFragments(previous.text, line.text, " "),
          bold: previous.bold && line.bold,
        };
        continue;
      }

      lines.push(withMargin);
    }
  }

  // Drop logos/decorations printed at the same spot on many pages.
  const boxPages = new Map<string, Set<number>>();

  for (const line of lines) {
    const box = (line as AocpLine & { imageBox?: string }).imageBox;

    if (box) {
      boxPages.set(box, (boxPages.get(box) ?? new Set()).add(line.page));
    }
  }

  return lines
    .filter((line) => {
      const box = (line as AocpLine & { imageBox?: string }).imageBox;
      return !box || (boxPages.get(box)?.size ?? 0) < REPEATED_IMAGE_PAGES;
    })
    .map((line): AocpLine => ({
      page: line.page,
      top: line.top,
      left: line.left,
      size: line.size,
      bold: line.bold,
      text: line.text,
      column: line.column,
      columnLeft: line.columnLeft,
      image: line.image,
    }));
}

function joinFragments(left: string, right: string, separator: string): string {
  // "perdê-" + "lo" -> "perdê-lo"
  return left.endsWith("-") ? `${left}${right}` : `${left}${separator}${right}`;
}

function appendLine(current: string, next: string): string {
  return current ? joinFragments(current, next, " ") : next;
}

type State = "between" | "support" | "statement" | "alternative";

type MutableQuestion = {
  number: number;
  variant: number;
  block: string | null;
  images: string[];
  supportImages: string[];
  section: string | null;
  statement: string;
  alternatives: { label: string; content: string; images: string[] }[];
  supportText: string | null;
  page: number;
};

export function parseAocpExam(
  lines: readonly AocpLine[],
): AocpExam {
  // Question markers use one dominant font size; bold digits in tables
  // and charts use other sizes and must not start questions.
  const markerSize = mostFrequent(
    lines
      .filter((line) => line.bold && QUESTION_NUMBER.test(line.text))
      .map((line) => line.size),
  );

  // Section (discipline) headings: largest bold non-numeric text that
  // is not a "BLOCO" grouping heading.
  const headingSize = Math.max(
    0,
    ...lines
      .filter(
        (line) =>
          line.bold &&
          !QUESTION_NUMBER.test(line.text) &&
          !BLOCK_HEADING.test(line.text),
      )
      .map((line) => line.size),
  );

  const seenNumbers = new Map<number, number>();

  const sections: string[] = [];
  const questions: MutableQuestion[] = [];

  let section: string | null = null;
  let block: string | null = null;
  let state: State = "between";
  let supportParts: string[] = [];
  let supportText: string | null = null;
  let pendingSupportImages: string[] = [];
  let supportImages: string[] = [];
  let question: MutableQuestion | null = null;

  const closeSupport = () => {
    if (state === "support") {
      const text = supportParts.filter(Boolean).join("\n\n").trim();

      if (text || pendingSupportImages.length > 0) {
        supportText = text || null;
        supportImages = pendingSupportImages;
      }
    }
  };

  const startSupport = (line: AocpLine) => {
    state = "support";
    supportParts = line.image ? [] : [line.bold ? `**${line.text}**` : line.text];
    pendingSupportImages = line.image ? [line.image] : [];
  };

  const appendSupport = (line: AocpLine) => {
    const isSourceLine = /^(adaptado de|dispon[ií]vel em|fonte)\b/i.test(line.text);
    const lastIndex = supportParts.length - 1;

    if (line.bold || isSourceLine || lastIndex < 0 || supportParts[lastIndex]!.startsWith("**")) {
      supportParts.push(line.bold ? `**${line.text}**` : line.text);
    } else {
      supportParts[lastIndex] = appendLine(supportParts[lastIndex]!, line.text);
    }
  };

  for (const line of lines) {
    if (line.image) {
      const indented = line.left - line.columnLeft >= 12;
      const currentAlternative = question?.alternatives[question.alternatives.length - 1];

      if (state === "statement" && question) {
        question.images.push(line.image);
      } else if (state === "alternative" && currentAlternative && indented) {
        currentAlternative.images.push(line.image);
      } else if ((state as State) === "support") {
        pendingSupportImages.push(line.image);
      } else {
        startSupport(line);
      }

      continue;
    }

    if (line.bold && BLOCK_HEADING.test(line.text) && line.size >= headingSize) {
      closeSupport();
      block = line.text;
      section = null;
      supportText = null;
      supportImages = [];
      state = "between";
      question = null;
      continue;
    }

    if (line.bold && line.size === headingSize && !QUESTION_NUMBER.test(line.text)) {
      closeSupport();

      if (END_OF_OBJECTIVE_PART.test(line.text)) {
        break;
      }

      section = line.text;
      sections.push(section);
      supportText = null;
      supportImages = [];
      state = "between";
      question = null;
      continue;
    }

    if (line.bold && line.size === markerSize && QUESTION_NUMBER.test(line.text)) {
      closeSupport();
      const number = Number(line.text);
      const variant = seenNumbers.get(number) ?? 0;
      seenNumbers.set(number, variant + 1);
      question = {
        number,
        variant,
        block,
        section,
        statement: "",
        images: [],
        alternatives: [],
        supportText,
        supportImages: [...supportImages],
        page: line.page,
      };
      questions.push(question);
      state = "statement";
      continue;
    }

    const alternative = question ? ALTERNATIVE_LABEL.exec(line.text) : null;

    if (question && alternative && (state === "statement" || state === "alternative")) {
      question.alternatives.push({ label: alternative[1]!, content: alternative[2] ?? "", images: [] });
      state = "alternative";
      continue;
    }

    const atColumnMargin = line.left - line.columnLeft < 12;

    if (state === "statement" && question) {
      question.statement = appendLine(question.statement, line.text);
    } else if (state === "alternative" && question) {
      if (atColumnMargin) {
        // Text back at the margin after the alternatives: a new support text.
        startSupport(line);
      } else {
        const current = question.alternatives[question.alternatives.length - 1]!;
        current.content = appendLine(current.content, line.text);
      }
    } else if ((state as State) === "support") {
      appendSupport(line);
    } else {
      startSupport(line);
    }
  }

  return {
    sections,
    questions: questions.map((item) => ({
      ...item,
      refersToHighlight: HIGHLIGHT_REFERENCE.test(item.statement),
      alternatives: item.alternatives.map((alternative) => ({
        ...alternative,
        images: [...alternative.images],
      })),
    })),
  };
}

function mostFrequent(values: readonly number[]): number | null {
  const counts = new Map<number, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  let best: number | null = null;
  let bestCount = 0;

  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }

  return best;
}

/** Structural problems that must block an import. */
export function validateAocpExam(
  exam: AocpExam,
  expectedAlternatives?: number,
): string[] {
  const issues: string[] = [];

  // Booklets use a fixed number of alternatives (4 or 5); detect it.
  const expected =
    expectedAlternatives ??
    mostFrequent(exam.questions.map((question) => question.alternatives.length)) ??
    4;
  const expectedLabels = "ABCDE".slice(0, expected);

  let highest = 0;

  for (const question of exam.questions) {
    const label = question.variant > 0
      ? `Questão ${question.number} (variante ${question.variant + 1})`
      : `Questão ${question.number}`;

    if (question.variant === 0) {
      if (question.number !== highest + 1) {
        issues.push(`Numeração fora de ordem: esperado ${highest + 1}, encontrado ${question.number}.`);
      }

      highest = Math.max(highest, question.number);
    }

    if (!question.statement.trim()) {
      issues.push(`${label}: enunciado vazio.`);
    }

    const labels = question.alternatives.map((alternative) => alternative.label).join("");

    if (labels !== expectedLabels) {
      issues.push(`${label}: alternativas "${labels}" (esperado "${expectedLabels}").`);
    }

    for (const alternative of question.alternatives) {
      if (!alternative.content.trim() && alternative.images.length === 0) {
        issues.push(`${label}: alternativa ${alternative.label} vazia.`);
      }
    }
  }

  return issues;
}

/**
 * Parses the official answer key text (`pdftotext`): pairs of question
 * number and letter. "X" marks an annulled question. A number listed
 * twice (optional-language blocks) keeps both answers in order.
 */
export function parseAocpAnswerKey(text: string): AocpAnswerKey {
  const tokens = text
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const key = new Map<number, AocpAnswer[]>();

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const number = tokens[index]!;
    const answer = tokens[index + 1]!.toUpperCase();

    if (/^\d{1,3}$/.test(number) && /^[A-EX]$/.test(answer)) {
      const answers = key.get(Number(number)) ?? [];
      answers.push(answer === "X" ? "ANNULLED" : answer);
      key.set(Number(number), answers);
      index += 1;
    }
  }

  return key;
}
