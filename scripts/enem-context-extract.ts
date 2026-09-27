import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import sharp from "sharp";

/*
 * Locates the context (everything between "QUESTÃO N" and the command
 * sentence) of ENEM questions that lost it in the legacy import, in the
 * official INEP booklets, and crops it as page images for review.
 *
 * Input:  data-private/enem-oficial/lost-context.json (code, year, day, number, statement)
 * Output: data-private/enem-oficial/contexts/<code>-<k>.png + contexts.json (regions, text)
 *
 *   npx tsx scripts/enem-context-extract.ts [Q100700 …]
 *
 * Read-only: nothing is written to the database.
 */

const DIR = resolve("data-private", "enem-oficial");
const OUT = join(DIR, "contexts");
const DPI = 150;

/** Official blue booklets per year and day (files downloaded from INEP). */
const BOOKLETS: Record<string, string> = {
  "2012-1": "2012_PV_D1_CD1_azul.pdf",
  "2012-2": "2012_PV_D2_CD7_azul.pdf",
  "2013-2": "2013_PV_D2_CD7_azul.pdf",
  "2014-1": "2014_PV_D1_CD1_azul.pdf",
  "2014-2": "2014_PV_D2_CD7_azul.pdf",
  "2015-1": "2015_PV_D1_CD1_azul.pdf",
  "2015-2": "2015_PV_D2_CD7_azul.pdf",
  "2016-1": "2016_PV_D1_CD1_azul.pdf",
  "2016-2": "2016_PV_D2_CD7_azul.pdf",
  "2017-2": "2017_PV_D2_CD7_azul.pdf",
  "2023-2": "2023_PV_D2_CD7_azul.pdf",
};

type Lost = { id: string; code: string; year: number; day: number | null; number: number | null; statement: string };

type Box = { page: number; column: 0 | 1; top: number; left: number; width: number; height: number; text: string };

type PageInfo = { number: number; width: number; height: number };

export type ContextRegion = { page: number; x: number; y: number; width: number; height: number };

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const decode = (value: string) =>
  value
    // Italic runs become Markdown italics (_…_), which the question text renders.
    .replace(/<i>\s*([\s\S]*?)\s*<\/i>/g, (_, inner: string) => (inner.trim() ? ` _${inner.trim()}_ ` : " "))
    .replace(/<[^>]+>/g, "")
    .replace(/ﬁ/g, "fi")
    .replace(/ﬂ/g, "fl")
    .replace(/ﬀ/g, "ff")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

const xmlCache = new Map<string, { pages: PageInfo[]; boxes: Box[] }>();

function readBooklet(pdf: string) {
  const cached = xmlCache.get(pdf);

  if (cached) {
    return cached;
  }

  const base = join(OUT, ".xml", pdf.replace(/\.pdf$/, ""));
  mkdirSync(join(OUT, ".xml"), { recursive: true });

  if (!existsSync(`${base}.xml`)) {
    execFileSync("pdftohtml", ["-xml", "-i", "-q", "-enc", "UTF-8", join(DIR, pdf), base]);
  }

  const xml = readFileSync(`${base}.xml`, "utf8");
  const pages: PageInfo[] = [];
  const boxes: Box[] = [];

  for (const page of xml.matchAll(/<page number="(\d+)"[^>]*height="(\d+)" width="(\d+)">([\s\S]*?)<\/page>/g)) {
    const info = { number: Number(page[1]), height: Number(page[2]), width: Number(page[3]) };
    pages.push(info);

    for (const text of page[4]!.matchAll(
      /<text top="(-?\d+)" left="(-?\d+)" width="(\d+)" height="(\d+)" font="\d+">([\s\S]*?)<\/text>/g,
    )) {
      const width = Number(text[3]);
      const height = Number(text[4]);
      const left = Number(text[2]);
      const content = decode(text[5]!);

      const top = Number(text[1]);

      // Rotated watermarks ("ENEM2016") come out with zero width; page
      // headers (logo, barcode "* A Z U L …") and footers are not content.
      if (!content || width === 0 || height < 6 || top < info.height * 0.075 || top > info.height * 0.95) {
        continue;
      }

      boxes.push({
        page: info.number,
        column: left + width / 2 < info.width / 2 ? 0 : 1,
        top,
        left,
        width,
        height,
        text: content,
      });
    }
  }

  // Single-column pages (2012 full-width items, 2023 layout): many lines
  // span most of the page, so there is no second column to separate.
  for (const info of pages) {
    const onPage = boxes.filter((box) => box.page === info.number);
    const wide = onPage.filter((box) => box.width > info.width * 0.55).length;

    if (onPage.length > 0 && wide / onPage.length > 0.25) {
      for (const box of onPage) {
        box.column = 0;
      }
    }
  }

  boxes.sort((a, b) => a.page - b.page || a.column - b.column || a.top - b.top || a.left - b.left);
  const parsed = { pages, boxes };
  xmlCache.set(pdf, parsed);

  return parsed;
}

/**
 * Rebuilds the context as paragraphs (a first-line indent or a larger gap
 * starts one) and flags "math" when small glyphs (sub/superscripts) or
 * stacked fraction parts are present — those stay as page images.
 */
function paragraphs(context: readonly Box[]): { paragraphs: string; hasMath: boolean } {
  const lines: Box[][] = [];

  for (const box of context) {
    const line = lines.find((items) => items[0]!.page === box.page && items[0]!.column === box.column && Math.abs(items[0]!.top - box.top) <= 4);
    if (line) line.push(box);
    else lines.push([box]);
  }

  const heights = context.map((box) => box.height).sort((a, b) => a - b);
  const median = heights[Math.floor(heights.length / 2)] ?? 0;
  const hasMath =
    context.some((box) => box.height < median * 0.72) ||
    context.some((box) => /^\d+$/.test(box.text) && context.some((other) => other !== box && Math.abs(other.left - box.left) < 6 && Math.abs(other.top - box.top) > 4 && Math.abs(other.top - box.top) < median * 1.6 && /^\d+$/.test(other.text)));

  const columnLeft = Math.min(...context.map((box) => box.left));
  const out: string[] = [];
  let current = "";
  let previous: Box | null = null;

  for (const line of lines) {
    line.sort((a, b) => a.left - b.left);
    const text = line.map((box) => box.text).join(" ").replace(/\s+/g, " ").trim();
    const first = line[0]!;
    const indented = first.left - columnLeft > 12;
    const gap = previous && previous.page === first.page ? first.top - (previous.top + previous.height) : 0;

    // A new paragraph needs the previous line to close a sentence; otherwise
    // an indented line is a hanging-indent continuation ("… 50 vezes em / 85 jogadas.").
    const closesSentence = /[.:;!?)"”]$/.test(current);
    const bullet = /^[•▪–-]\s/.test(text);
    const afterBullet = /^[•▪]\s/.test(current);

    if (current && (bullet || (afterBullet && indented) || (closesSentence && (indented || gap > median * 0.8)))) {
      out.push(current);
      current = "";
    }

    current = current ? `${current} ${text}` : text;
    previous = first;
  }

  if (current) out.push(current);

  const tidy = (paragraph: string) =>
    paragraph
      .replace(/\s+([,.;!?)])/g, "$1") // "show ," → "show," (":" kept: "escala 1 : 8")
      .replace(/_\s+_/g, " ")
      .replace(/([(])\s+/g, "$1")
      .replace(/(\p{L})- (\p{Ll})/gu, "$1-$2"); // "verde- amarelo" (line break in a compound)

  return { paragraphs: out.map(tidy).join("\n\n"), hasMath };
}

function locate(question: Lost) {
  const pdf = BOOKLETS[`${question.year}-${question.day}`];

  if (!pdf || !question.number) {
    return { error: "sem caderno oficial para este ano/dia" } as const;
  }

  const { pages, boxes } = readBooklet(pdf);
  const header = new RegExp(`^QUEST[ÃA]O\\s*0?${question.number}\\b`, "i");
  const start = boxes.findIndex((box) => header.test(box.text));

  if (start < 0) {
    return { error: `QUESTÃO ${question.number} não localizada` } as const;
  }

  // The command starts a line; match its first characters in the lines that follow.
  const target = normalize(question.statement).slice(0, 24);
  let end = -1;

  for (let index = start + 1; index < Math.min(boxes.length, start + 400); index += 1) {
    if (/^QUEST[ÃA]O\s*\d+/i.test(boxes[index]!.text)) {
      break;
    }

    const window = normalize(boxes.slice(index, index + 3).map((box) => box.text).join(" "));

    if (window.startsWith(target)) {
      end = index;
      break;
    }
  }

  if (end < 0) {
    return { error: "início do enunciado não localizado" } as const;
  }

  // One region per page/column the context spans.
  const regions: ContextRegion[] = [];
  const headerBox = boxes[start]!;
  const context = boxes.slice(start + 1, end);

  for (const box of context) {
    const page = pages.find((item) => item.number === box.page)!;
    const last = regions[regions.length - 1];
    const columnX = box.column === 0 ? 0 : page.width / 2;
    const scale = DPI / 72 / 1.5;

    if (last && last.page === box.page && Math.abs(last.x - Math.round(columnX * scale)) < 2) {
      const bottom = Math.max(last.y + last.height, Math.round((box.top + box.height) * scale));
      last.height = bottom - last.y;
    } else {
      const top = box.page === headerBox.page && box.column === headerBox.column ? headerBox.top + headerBox.height : box.top;
      regions.push({
        page: box.page,
        x: Math.round(columnX * scale),
        y: Math.max(0, Math.round((top + 2) * scale)),
        width: Math.round((page.width / 2) * scale),
        height: Math.round((box.top + box.height - top) * scale),
      });
    }
  }

  // Figures have no text: extend each region down to the next text line
  // (the command, or the next column's first line) minus a small margin.
  for (const [index, region] of regions.entries()) {
    const next = index === regions.length - 1 ? boxes[end]! : null;

    if (next && next.page === region.page) {
      const scale = DPI / 72 / 1.5;
      region.height = Math.max(region.height, Math.round((next.top - 3) * scale) - region.y);
    }
  }

  // Crop to the text's own width (+ padding) instead of the half page: keeps
  // wide lines whole and leaves out the booklet's black margin tabs.
  const scale = DPI / 72 / 1.5;
  const PAD = 10;

  for (const region of regions) {
    const inRegion = context.filter(
      (box) => box.page === region.page && Math.abs(Math.round((box.column === 0 ? 0 : pages.find((p) => p.number === box.page)!.width / 2) * scale) - region.x) < 2,
    );
    const left = Math.min(...inRegion.map((box) => box.left));
    const right = Math.max(...inRegion.map((box) => box.left + box.width));

    if (Number.isFinite(left) && Number.isFinite(right)) {
      region.x = Math.max(0, Math.round(left * scale) - PAD);
      region.width = Math.round((right - left) * scale) + PAD + 2; // tight on the right: the column rule sits just after the text
    }
  }

  return {
    pdf,
    regions: regions.map((region) => ({ ...region, height: region.height + 6 })),
    text: context.map((box) => box.text).join(" ").replace(/\s+/g, " ").trim(),
    ...paragraphs(context),
  } as const;
}

/**
 * Column rules and stray letters of the neighbouring column sit near the
 * crop's left/right edges. Returns how many pixels to cut on each side:
 * everything from the outermost near-edge column that is dark on most
 * rows (a vertical rule) outwards.
 */
async function edgeTrim(png: string): Promise<{ left: number; right: number }> {
  const { data, info } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
  const darkRatio = (x: number) => {
    let dark = 0;
    for (let y = 0; y < info.height; y += 1) {
      if (data[y * info.width + x]! < 140) dark += 1;
    }
    return dark / info.height;
  };
  const EDGE = 40;
  let right = 0;
  let left = 0;

  for (let x = info.width - 1; x >= info.width - EDGE && x > 0; x -= 1) {
    if (darkRatio(x) > 0.45) right = info.width - x + 3;
  }

  for (let x = 0; x < EDGE && x < info.width; x += 1) {
    if (darkRatio(x) > 0.45) left = x + 4;
  }

  return { left, right };
}

function crop(pdf: string, region: ContextRegion, prefix: string): string {
  execFileSync("pdftoppm", [
    "-f", String(region.page), "-l", String(region.page), "-r", String(DPI),
    "-x", String(region.x), "-y", String(region.y), "-W", String(region.width), "-H", String(region.height),
    "-png", "-singlefile", join(DIR, pdf), prefix,
  ]);
  return `${prefix}.png`;
}

async function main() {
  const wanted = new Set(process.argv.slice(2));
  const lost: Lost[] = JSON.parse(readFileSync(join(DIR, "lost-context.json"), "utf8"));
  const results: unknown[] = [];

  mkdirSync(OUT, { recursive: true });

  // Reviewed manual regions (150 dpi pixels) for layouts the locator misreads.
  const manualPath = join(DIR, "contexts-manual.json");
  const manual: Record<string, { pdf: string; regions: ContextRegion[] }> = existsSync(manualPath)
    ? JSON.parse(readFileSync(manualPath, "utf8"))
    : {};

  for (const question of lost.filter((item) => wanted.size === 0 || wanted.has(item.code))) {
    const override = manual[question.code];
    const found = override ? { ...override, text: "" } : locate(question);

    if ("error" in found) {
      console.log(`✗ ${question.code} (${question.year} #${question.number}): ${found.error}`);
      results.push({ ...question, error: found.error });
      continue;
    }

    const crops: string[] = [];

    for (const [index, region] of found.regions.entries()) {
      const prefix = join(OUT, `${question.code}-${index + 1}`);
      const trim = await edgeTrim(crop(found.pdf, region, prefix));

      if (trim.left + trim.right > 0) {
        region.x += trim.left;
        region.width -= trim.left + trim.right;
      }

      crops.push(crop(found.pdf, region, prefix));
    }

    console.log(`✓ ${question.code} (${question.year} #${question.number}): ${found.regions.length} região(ões), ${found.text.length} caracteres`);
    results.push({ ...question, pdf: found.pdf, dpi: DPI, regions: found.regions, crops, text: found.text, paragraphs: "paragraphs" in found ? found.paragraphs : "", hasMath: "hasMath" in found ? found.hasMath : true });
  }

  writeFileSync(join(DIR, "contexts.json"), JSON.stringify(results, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
