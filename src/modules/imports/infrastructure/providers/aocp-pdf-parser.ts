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
 * - "Redação" sections end the objective part.
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
}>;

export type AocpAlternative = Readonly<{
  label: string;
  content: string;
}>;

export type AocpQuestion = Readonly<{
  number: number;
  /**
   * The statement refers to a highlighted/underlined term. Underlines
   * are drawn shapes that pdftohtml cannot export, so a reviewer must
   * check the highlight against the original PDF.
   */
  refersToHighlight: boolean;
  section: string | null;
  statement: string;
  alternatives: readonly AocpAlternative[];
  supportText: string | null;
  page: number;
}>;

export type AocpExam = Readonly<{
  sections: readonly string[];
  questions: readonly AocpQuestion[];
}>;

export type AocpAnswerKey = ReadonlyMap<number, string | "ANNULLED">;

const HEADER_MAX_TOP = 75;
const FOOTER_MIN_RATIO = 0.93;
const SAME_LINE_TOLERANCE = 4;
const ALTERNATIVE_LABEL = /^\(([A-E])\)\s*(.*)$/;
const QUESTION_NUMBER = /^\d{1,3}$/;
const END_OF_OBJECTIVE_PART = /reda[cç][aã]o/i;
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
      });
    }

    // Column margin = smallest left offset used in that column.
    const margins = [0, 1].map((column) =>
      Math.min(
        ...pageLines
          .filter((line) => line.column === column)
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
        previous &&
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

  return lines;
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
  section: string | null;
  statement: string;
  alternatives: { label: string; content: string }[];
  supportText: string | null;
  page: number;
};

export function parseAocpExam(
  lines: readonly AocpLine[],
): AocpExam {
  const headingSize = Math.max(0, ...lines.filter((line) => line.bold).map((line) => line.size));
  const markerSizes = new Set(
    lines
      .filter((line) => line.bold && QUESTION_NUMBER.test(line.text))
      .map((line) => line.size),
  );

  const sections: string[] = [];
  const questions: MutableQuestion[] = [];

  let section: string | null = null;
  let state: State = "between";
  let supportParts: string[] = [];
  let supportText: string | null = null;
  let question: MutableQuestion | null = null;

  const closeSupport = () => {
    if (state === "support") {
      const text = supportParts.filter(Boolean).join("\n\n").trim();
      supportText = text || supportText;
    }
  };

  const startSupport = (line: AocpLine) => {
    state = "support";
    supportParts = [line.bold ? `**${line.text}**` : line.text];
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
    if (line.bold && line.size === headingSize && !QUESTION_NUMBER.test(line.text)) {
      closeSupport();

      if (END_OF_OBJECTIVE_PART.test(line.text)) {
        break;
      }

      section = line.text;
      sections.push(section);
      supportText = null;
      state = "between";
      question = null;
      continue;
    }

    if (line.bold && markerSizes.has(line.size) && QUESTION_NUMBER.test(line.text)) {
      closeSupport();
      question = {
        number: Number(line.text),
        section,
        statement: "",
        alternatives: [],
        supportText,
        page: line.page,
      };
      questions.push(question);
      state = "statement";
      continue;
    }

    const alternative = question ? ALTERNATIVE_LABEL.exec(line.text) : null;

    if (question && alternative && (state === "statement" || state === "alternative")) {
      question.alternatives.push({ label: alternative[1]!, content: alternative[2] ?? "" });
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
      alternatives: item.alternatives.map((alternative) => ({ ...alternative })),
    })),
  };
}

/** Structural problems that must block an import. */
export function validateAocpExam(
  exam: AocpExam,
  expectedAlternatives = 4,
): string[] {
  const issues: string[] = [];

  exam.questions.forEach((question, index) => {
    if (question.number !== index + 1) {
      issues.push(`Numeração fora de ordem: esperado ${index + 1}, encontrado ${question.number}.`);
    }

    if (!question.statement.trim()) {
      issues.push(`Questão ${question.number}: enunciado vazio.`);
    }

    const labels = question.alternatives.map((alternative) => alternative.label).join("");
    const expected = "ABCDE".slice(0, expectedAlternatives);

    if (labels !== expected) {
      issues.push(`Questão ${question.number}: alternativas "${labels}" (esperado "${expected}").`);
    }

    for (const alternative of question.alternatives) {
      if (!alternative.content.trim()) {
        issues.push(`Questão ${question.number}: alternativa ${alternative.label} vazia.`);
      }
    }
  });

  return issues;
}

/**
 * Parses the official answer key text (`pdftotext`): pairs of question
 * number and letter. "X" marks an annulled question.
 */
export function parseAocpAnswerKey(text: string): AocpAnswerKey {
  const tokens = text
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const key = new Map<number, string | "ANNULLED">();

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const number = tokens[index]!;
    const answer = tokens[index + 1]!.toUpperCase();

    if (/^\d{1,3}$/.test(number) && /^[A-EX]$/.test(answer)) {
      key.set(Number(number), answer === "X" ? "ANNULLED" : answer);
      index += 1;
    }
  }

  return key;
}
