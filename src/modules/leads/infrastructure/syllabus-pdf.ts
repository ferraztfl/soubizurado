import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

/*
 * The "edital verticalizado" of one position as a printable A4 PDF: branded
 * cover, exam summary, one checklist table per subject (Teoria, Questões,
 * Revisão 1, Revisão 2) and a closing page. Standard fonts only (no font
 * files), so the text is sanitized to what they can draw.
 */

export type SyllabusPdfData = Readonly<{
  contestName: string;
  organizationName: string;
  boardName: string | null;
  examDate: string | null;
  syllabusTitle: string;
  essayPoints: number | null;
  durationMinutes: number | null;
  notes: string;
  subjects: readonly Readonly<{
    name: string;
    block: string | null;
    questionCount: number | null;
    topics: readonly Readonly<{ code: string | null; text: string }>[];
  }>[];
  /** "soubizurado.com.br" (shown) and the public page of this syllabus. */
  siteHost: string;
  pageUrl: string;
}>;

const A4 = { width: 595.28, height: 841.89 } as const;
const MARGIN = 42;
const BRAND = rgb(0.83, 0.07, 0);
const DARK = rgb(0.082, 0.086, 0.11);
const INK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.39, 0.45, 0.55);
const LINE = rgb(0.86, 0.88, 0.91);
const SOFT = rgb(0.96, 0.97, 0.98);
const WHITE = rgb(1, 1, 1);
const GOLD = rgb(1, 0.78, 0.24);

const CHECK_COLUMNS = ["Teoria", "Questões", "Rev. 1", "Rev. 2"] as const;
const CHECK_WIDTH = 46;

const REPLACEMENTS: Readonly<Record<string, string>> = {
  "≥": ">=",
  "≤": "<=",
  "→": "->",
  "−": "-",
  "‑": "-",
  "ﬁ": "fi",
  "ﬂ": "fl",
  " ": " ",
  "​": "",
  "\t": " ",
};

type Fonts = Readonly<{ regular: PDFFont; bold: PDFFont; supported: ReadonlySet<number> }>;

/** Only characters the standard fonts can draw (others are mapped or dropped). */
function clean(text: string, fonts: Fonts): string {
  let out = "";
  for (const char of text.replace(/\s+/g, " ")) {
    const mapped = REPLACEMENTS[char] ?? char;
    for (const piece of mapped) {
      if (fonts.supported.has(piece.codePointAt(0)!)) out += piece;
    }
  }
  return out.trim();
}

/** Breaks a text into lines that fit `maxWidth` (long words are cut). */
export function wrapText(text: string, measure: (value: string) => number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ").filter(Boolean)) {
    let rest = word;
    while (measure(rest) > maxWidth) {
      let cut = rest.length - 1;
      while (cut > 1 && measure(rest.slice(0, cut)) > maxWidth) cut -= 1;
      if (line) {
        lines.push(line);
        line = "";
      }
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    const candidate = line ? `${line} ${rest}` : rest;
    if (measure(candidate) <= maxWidth) line = candidate;
    else {
      lines.push(line);
      line = rest;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawLines(page: PDFPage, lines: readonly string[], x: number, y: number, font: PDFFont, size: number, color = INK, leading = size * 1.35): number {
  let cursor = y;
  for (const line of lines) {
    page.drawText(line, { x, y: cursor, size, font, color });
    cursor -= leading;
  }
  return cursor;
}

async function loadLogo(pdf: PDFDocument): Promise<PDFImage | null> {
  try {
    return await pdf.embedPng(await readFile(join(process.cwd(), "public", "brand", "logo-mark.png")));
  } catch {
    return null; // The PDF still works without the mark.
  }
}

export async function buildSyllabusPdf(data: SyllabusPdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fonts: Fonts = { regular, bold, supported: new Set(regular.getCharacterSet()) };
  const logo = await loadLogo(pdf);
  const t = (text: string) => clean(text, fonts);
  const width = (font: PDFFont, size: number) => (value: string) => font.widthOfTextAtSize(value, size);
  const contentWidth = A4.width - MARGIN * 2;

  pdf.setTitle(t(`Edital verticalizado - ${data.syllabusTitle} - ${data.contestName}`));
  pdf.setAuthor("Sou Bizurado");
  pdf.setSubject(t(`Conteúdo programático de ${data.syllabusTitle} (${data.contestName})`));
  pdf.setCreator(data.siteHost);

  const totalQuestions = data.subjects.reduce((sum, subject) => sum + (subject.questionCount ?? 0), 0);
  const totalTopics = data.subjects.reduce((sum, subject) => sum + subject.topics.length, 0);

  /* ------------------------------------------------------------- cover */
  const cover = pdf.addPage([A4.width, A4.height]);
  cover.drawRectangle({ x: 0, y: 0, width: A4.width, height: A4.height, color: DARK });
  cover.drawRectangle({ x: 0, y: A4.height - 14, width: A4.width, height: 14, color: BRAND });
  cover.drawRectangle({ x: 0, y: 0, width: A4.width, height: 110, color: BRAND });
  let y = A4.height - 110;
  if (logo) {
    const size = 120;
    const scaled = logo.scaleToFit(size, size);
    cover.drawImage(logo, { x: (A4.width - scaled.width) / 2, y: y - scaled.height, width: scaled.width, height: scaled.height });
    y -= scaled.height + 34;
  }
  const centered = (page: PDFPage, text: string, font: PDFFont, size: number, top: number, color = WHITE) => {
    page.drawText(text, { x: (A4.width - font.widthOfTextAtSize(text, size)) / 2, y: top, size, font, color });
  };
  centered(cover, "EDITAL VERTICALIZADO", bold, 13, y, GOLD);
  y -= 46;
  for (const line of wrapText(t(data.syllabusTitle), width(bold, 30), contentWidth)) {
    centered(cover, line, bold, 30, y);
    y -= 38;
  }
  y -= 4;
  for (const line of wrapText(t(data.contestName), width(regular, 17), contentWidth)) {
    centered(cover, line, regular, 17, y, rgb(0.85, 0.86, 0.9));
    y -= 24;
  }
  y -= 26;
  const facts = [
    `${data.subjects.length} matérias`,
    totalQuestions > 0 ? `${totalQuestions} questões objetivas` : null,
    `${totalTopics} assuntos`,
    data.essayPoints !== null ? `Redação: ${data.essayPoints} pontos` : null,
    data.boardName ? `Banca: ${data.boardName}` : null,
    data.examDate ? `Prova: ${data.examDate}` : null,
  ].filter((fact): fact is string => fact !== null);
  for (const fact of facts) {
    centered(cover, t(fact), regular, 13, y, WHITE);
    y -= 21;
  }
  centered(cover, t("Todas as matérias e assuntos do edital, com checklist para marcar"), regular, 11.5, 172, rgb(0.8, 0.81, 0.86));
  centered(cover, t("teoria, questões e revisões."), regular, 11.5, 156, rgb(0.8, 0.81, 0.86));
  centered(cover, data.siteHost, bold, 22, 62);
  centered(cover, t("Questões, teoria e simulados para concursos"), regular, 11, 40);

  /* ----------------------------------------------------- content pages */
  const pages: PDFPage[] = [];
  let page!: PDFPage;
  const newPage = () => {
    page = pdf.addPage([A4.width, A4.height]);
    pages.push(page);
    page.drawRectangle({ x: 0, y: A4.height - 8, width: A4.width, height: 8, color: BRAND });
    y = A4.height - MARGIN - 6;
  };
  const ensure = (needed: number) => {
    if (y - needed < MARGIN + 26) newPage();
  };
  const paragraph = (text: string, size = 10.5, color = INK, font = regular) => {
    for (const line of wrapText(t(text), width(font, size), contentWidth)) {
      ensure(size * 1.4);
      page.drawText(line, { x: MARGIN, y, size, font, color });
      y -= size * 1.4;
    }
  };
  const heading = (text: string) => {
    ensure(40);
    page.drawText(t(text), { x: MARGIN, y, size: 16, font: bold, color: INK });
    y -= 10;
    page.drawRectangle({ x: MARGIN, y, width: 46, height: 3, color: BRAND });
    y -= 20;
  };

  newPage();
  heading("Como usar este edital verticalizado");
  paragraph(
    "Cada matéria traz os assuntos do conteúdo programático na ordem do edital. Para cada assunto, marque as colunas conforme avança: Teoria (estudou o conteúdo), Questões (resolveu questões do assunto), Rev. 1 e Rev. 2 (revisões espaçadas — por exemplo, 7 e 30 dias depois).",
  );
  y -= 6;
  paragraph("Comece pelas matérias com mais questões e não deixe nenhuma zerada: a banca costuma exigir pontuação mínima por bloco.");
  y -= 14;

  heading("Resumo da prova objetiva");
  const summaryColumns = [contentWidth - 190, 120, 70] as const;
  const row = (cells: readonly string[], font: PDFFont, fill: ReturnType<typeof rgb> | null, color = INK) => {
    ensure(22);
    if (fill) page.drawRectangle({ x: MARGIN, y: y - 6, width: contentWidth, height: 20, color: fill });
    let x = MARGIN + 8;
    cells.forEach((cell, index) => {
      const text = wrapText(t(cell), width(font, 10), summaryColumns[index]! - 12)[0] ?? "";
      page.drawText(text, { x, y, size: 10, font, color });
      x += summaryColumns[index]!;
    });
    y -= 20;
  };
  row(["Matéria", "Bloco", "Questões"], bold, DARK, WHITE);
  data.subjects.forEach((subject, index) =>
    row([subject.name, subject.block ?? "-", subject.questionCount === null ? "-" : String(subject.questionCount)], regular, index % 2 === 0 ? SOFT : null),
  );
  if (totalQuestions > 0) row(["Total", "", String(totalQuestions)], bold, null);
  y -= 8;
  if (data.essayPoints !== null) paragraph(`Redação: ${data.essayPoints} pontos.`, 10.5, INK, bold);
  if (data.durationMinutes) paragraph(`Duração da prova: ${Math.round(data.durationMinutes / 60)} horas.`, 10.5, INK, bold);
  if (data.notes) {
    y -= 4;
    paragraph(data.notes, 10, MUTED);
  }

  /* -------------------------------------------------- one table/subject */
  const textWidth = contentWidth - CHECK_WIDTH * CHECK_COLUMNS.length - 34;
  const tableHeader = (subject: SyllabusPdfData["subjects"][number], continued: boolean) => {
    ensure(64);
    page.drawRectangle({ x: MARGIN, y: y - 8, width: contentWidth, height: 26, color: DARK });
    const title = wrapText(t(`${subject.name}${continued ? " (continuação)" : ""}`), width(bold, 12), contentWidth - 150)[0] ?? "";
    page.drawText(title, { x: MARGIN + 10, y: y + 1, size: 12, font: bold, color: WHITE });
    const meta = t([subject.block, subject.questionCount === null ? null : `${subject.questionCount} questões`].filter(Boolean).join(" · "));
    if (meta) page.drawText(meta, { x: MARGIN + contentWidth - 10 - regular.widthOfTextAtSize(meta, 9.5), y: y + 2, size: 9.5, font: regular, color: GOLD });
    y -= 26;
    let x = MARGIN + contentWidth - CHECK_WIDTH * CHECK_COLUMNS.length;
    for (const label of CHECK_COLUMNS) {
      const text = t(label);
      page.drawText(text, { x: x + (CHECK_WIDTH - bold.widthOfTextAtSize(text, 7.5)) / 2, y, size: 7.5, font: bold, color: MUTED });
      x += CHECK_WIDTH;
    }
    page.drawText("Assunto", { x: MARGIN + 34, y, size: 7.5, font: bold, color: MUTED });
    y -= 8;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + contentWidth, y }, thickness: 0.8, color: LINE });
    y -= 13;
  };

  for (const subject of data.subjects) {
    if (subject.topics.length === 0) continue;
    if (y < MARGIN + 150) newPage();
    else y -= 10;
    tableHeader(subject, false);

    for (const topic of subject.topics) {
      const lines = wrapText(t(topic.text), width(regular, 9.5), textWidth);
      const height = Math.max(lines.length * 12.5, 15) + 7;
      if (y - height < MARGIN + 26) {
        newPage();
        tableHeader(subject, true);
      }
      if (topic.code) page.drawText(t(topic.code), { x: MARGIN + 4, y, size: 9, font: bold, color: BRAND });
      drawLines(page, lines, MARGIN + 34, y, regular, 9.5, INK, 12.5);
      let x = MARGIN + contentWidth - CHECK_WIDTH * CHECK_COLUMNS.length;
      for (let column = 0; column < CHECK_COLUMNS.length; column += 1) {
        page.drawRectangle({ x: x + (CHECK_WIDTH - 11) / 2, y: y - 2.5, width: 11, height: 11, borderColor: MUTED, borderWidth: 0.9, color: WHITE });
        x += CHECK_WIDTH;
      }
      y -= height;
      page.drawLine({ start: { x: MARGIN, y: y + 9 }, end: { x: MARGIN + contentWidth, y: y + 9 }, thickness: 0.4, color: LINE });
    }
  }

  /* -------------------------------------------------------- closing page */
  newPage();
  heading("Continue a preparação no Sou Bizurado");
  for (const item of [
    "Teoria Completa do seu cargo, na ordem do edital, com grifo, anotações e áudio.",
    "Questões de provas anteriores com gabarito oficial, filtradas por banca e por assunto.",
    "Simulados no tempo da prova, revisão espaçada dos seus erros e desempenho por matéria.",
    "Este edital verticalizado on-line, com checklist que salva o seu progresso.",
  ]) {
    const lines = wrapText(t(item), width(regular, 11), contentWidth - 18);
    ensure(lines.length * 15 + 6);
    page.drawRectangle({ x: MARGIN, y: y + 1, width: 6, height: 6, color: BRAND });
    y = drawLines(page, lines, MARGIN + 18, y, regular, 11, INK, 15) - 6;
  }
  y -= 12;
  ensure(90);
  page.drawRectangle({ x: MARGIN, y: y - 62, width: contentWidth, height: 78, color: DARK });
  page.drawText(t("Acesse o edital on-line e os combos do seu concurso:"), { x: MARGIN + 16, y: y - 8, size: 11, font: regular, color: WHITE });
  const url = wrapText(t(data.pageUrl.replace(/^https?:\/\//, "")), width(bold, 12.5), contentWidth - 32)[0] ?? data.siteHost;
  page.drawText(url, { x: MARGIN + 16, y: y - 30, size: 12.5, font: bold, color: GOLD });
  page.drawText(t(`${data.siteHost}/loja`), { x: MARGIN + 16, y: y - 50, size: 11, font: regular, color: WHITE });
  y -= 92;
  paragraph(
    `Conteúdo programático transcrito do edital oficial de ${data.organizationName}. Em caso de divergência, vale o edital publicado pelo órgão e pela banca.`,
    9,
    MUTED,
  );

  /* -------------------------------------------------------------- footers */
  pages.forEach((item, index) => {
    const left = t(`${data.siteHost} · Edital verticalizado · ${data.syllabusTitle}`);
    item.drawLine({ start: { x: MARGIN, y: MARGIN + 8 }, end: { x: A4.width - MARGIN, y: MARGIN + 8 }, thickness: 0.5, color: LINE });
    item.drawText(wrapText(left, width(regular, 8), contentWidth - 80)[0] ?? "", { x: MARGIN, y: MARGIN - 4, size: 8, font: regular, color: MUTED });
    const right = `${index + 1} / ${pages.length}`;
    item.drawText(right, { x: A4.width - MARGIN - regular.widthOfTextAtSize(right, 8), y: MARGIN - 4, size: 8, font: regular, color: MUTED });
  });

  return pdf.save();
}
