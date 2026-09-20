import {
  execFile,
} from "node:child_process";
import {
  createHash,
} from "node:crypto";
import {
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";
import {
  tmpdir,
} from "node:os";
import {
  join,
} from "node:path";
import {
  promisify,
} from "node:util";

import type {
  ProviderExaminationMetadata,
  ProviderQuestionCandidate,
  QuestionProvider,
  QuestionProviderListInput,
  QuestionProviderListResult,
} from "../../application/ports/question-provider";

const execFileAsync = promisify(execFile);

const GRAN_SIMULADO_URL =
  "https://questoes.grancursosonline.com.br/aluno/simulado/29401523/resolver";

type PdfTextSpan = Readonly<{
  page: number;
  top: number;
  left: number;
  width: number;
  height: number;
  text: string;
}>;

type PdfImageSpan = Readonly<{
  page: number;
  top: number;
  left: number;
  width: number;
  height: number;
  src: string;
}>;

type PdfPage = Readonly<{
  number: number;
  width: number;
  height: number;
  texts: readonly PdfTextSpan[];
  images: readonly PdfImageSpan[];
}>;

type ParsedQuestion = Readonly<{
  ordinal: number;
  providerQuestionId: string;
  officialQuestionNumber: number | null;
  area: string | null;
  subjectPath: readonly string[];
  statement: string;
  alternatives: readonly Readonly<{
    label: string;
    content: string;
    imageCount: number;
  }>[];
  answerKey: string | null;
  startPage: number;
  endPage: number;
  images: readonly PdfImageSpan[];
  hasVisualCue: boolean;
  rawText: string;
}>;

type ParsedDocument = Readonly<{
  checksum: string;
  questions: readonly ParsedQuestion[];
}>;

type MutableQuestionBlock = {
  ordinal: number;
  providerQuestionId: string;
  spans: PdfTextSpan[];
  images: PdfImageSpan[];
};

export type EnemPdfProviderOptions =
  Readonly<{
    pdfPath: string;
    year: number;
    sourceUrl?: string;
    pdftohtmlBinary?: string;
    extractDocument?: (
      input: Readonly<{
        pdfPath: string;
        year: number;
      }>,
    ) => Promise<ParsedDocument>;
  }>;

function xmlAttribute(
  attributes: string,
  name: string,
): string | null {
  const match = new RegExp(
    `\\b${name}="([^"]*)"`,
  ).exec(attributes);

  return match?.[1] ?? null;
}

function decodeXml(
  value: string,
): string {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(
      /&#(\d+);/g,
      (_, code: string) =>
        String.fromCodePoint(
          Number(code),
        ),
    )
    .replace(
      /&#x([0-9a-f]+);/gi,
      (_, code: string) =>
        String.fromCodePoint(
          Number.parseInt(code, 16),
        ),
    )
    .replace(/\s+/g, " ")
    .trim();
}

function numberAttribute(
  attributes: string,
  name: string,
): number {
  const raw =
    xmlAttribute(
      attributes,
      name,
    );

  if (!raw) {
    return 0;
  }

  const value = Number(raw);

  return Number.isFinite(value)
    ? value
    : 0;
}

export function parsePdftohtmlXml(
  xml: string,
): readonly PdfPage[] {
  const pages: PdfPage[] = [];
  const pageRegex =
    /<page\s+([^>]*)>([\s\S]*?)<\/page>/g;

  for (
    const match of
    xml.matchAll(pageRegex)
  ) {
    const attributes =
      match[1] ?? "";
    const body =
      match[2] ?? "";
    const pageNumber =
      numberAttribute(
        attributes,
        "number",
      );
    const pageWidth =
      numberAttribute(
        attributes,
        "width",
      );
    const pageHeight =
      numberAttribute(
        attributes,
        "height",
      );

    const texts: PdfTextSpan[] = [];
    const textRegex =
      /<text\s+([^>]*)>([\s\S]*?)<\/text>/g;

    for (
      const textMatch of
      body.matchAll(textRegex)
    ) {
      const textAttributes =
        textMatch[1] ?? "";
      const text =
        decodeXml(
          textMatch[2] ?? "",
        );

      if (!text) {
        continue;
      }

      texts.push({
        page: pageNumber,
        top: numberAttribute(
          textAttributes,
          "top",
        ),
        left: numberAttribute(
          textAttributes,
          "left",
        ),
        width: numberAttribute(
          textAttributes,
          "width",
        ),
        height: numberAttribute(
          textAttributes,
          "height",
        ),
        text,
      });
    }

    const images: PdfImageSpan[] = [];
    const imageRegex =
      /<image\s+([^>]*?)\/?\s*>/g;

    for (
      const imageMatch of
      body.matchAll(imageRegex)
    ) {
      const imageAttributes =
        imageMatch[1] ?? "";
      const src =
        xmlAttribute(
          imageAttributes,
          "src",
        );

      if (!src) {
        continue;
      }

      images.push({
        page: pageNumber,
        top: numberAttribute(
          imageAttributes,
          "top",
        ),
        left: numberAttribute(
          imageAttributes,
          "left",
        ),
        width: numberAttribute(
          imageAttributes,
          "width",
        ),
        height: numberAttribute(
          imageAttributes,
          "height",
        ),
        src,
      });
    }

    pages.push({
      number: pageNumber,
      width: pageWidth,
      height: pageHeight,
      texts,
      images,
    });
  }

  return pages.sort(
    (first, second) =>
      first.number - second.number,
  );
}

function isBoilerplateText(
  span: PdfTextSpan,
  page: PdfPage,
): boolean {
  if (
    span.top < 45 ||
    span.top >
      page.height - 40
  ) {
    return true;
  }

  const normalized =
    span.text.trim();

  return (
    normalized === "Simulado" ||
    normalized.startsWith(
      "Criado em:",
    ) ||
    normalized.startsWith(
      "Gran Cursos Questões -",
    ) ||
    normalized ===
      GRAN_SIMULADO_URL
  );
}

function orderedPageTexts(
  page: PdfPage,
): PdfTextSpan[] {
  return page.texts
    .filter(
      (span) =>
        !isBoilerplateText(
          span,
          page,
        ),
    )
    .slice()
    .sort(
      (first, second) =>
        first.top - second.top ||
        first.left - second.left,
    );
}

function orderedPageImages(
  page: PdfPage,
): PdfImageSpan[] {
  return page.images
    .filter(
      (image) =>
        image.top >= 45 &&
        image.top <=
          page.height - 40,
    )
    .slice()
    .sort(
      (first, second) =>
        first.top - second.top ||
        first.left - second.left,
    );
}

function questionMarker(
  text: string,
): Readonly<{
  ordinal: number;
  providerQuestionId: string;
}> | null {
  const match =
    /^(\d+)\.\s*\[(Q\d+)\]/.exec(
      text.trim(),
    );

  if (!match) {
    return null;
  }

  const ordinal =
    Number(match[1]);

  if (
    !Number.isSafeInteger(ordinal) ||
    ordinal < 1
  ) {
    return null;
  }

  return {
    ordinal,
    providerQuestionId:
      match[2]!,
  };
}

function stripQuestionMarker(
  text: string,
): string {
  return text
    .replace(
      /^\d+\.\s*\[Q\d+\]\s*/,
      "",
    )
    .trim();
}

function isAreaHeading(
  value: string,
): boolean {
  const normalized =
    value
      .normalize("NFKD")
      .replace(
        /[\u0300-\u036f]/g,
        "",
      )
      .toLocaleUpperCase(
        "pt-BR",
      );

  return [
    "CIENCIAS DA NATUREZA E SUAS TECNOLOGIAS",
    "CIENCIAS HUMANAS E SUAS TECNOLOGIAS",
    "LINGUAGENS, CODIGOS E SUAS TECNOLOGIAS",
    "LINGUAGENS E SUAS TECNOLOGIAS",
    "MATEMATICA E SUAS TECNOLOGIAS",
  ].includes(normalized);
}

function normalizeAreaHeading(
  value: string,
): string | null {
  const normalized =
    value
      .normalize("NFKD")
      .replace(
        /[\u0300-\u036f]/g,
        "",
      )
      .toLocaleUpperCase(
        "pt-BR",
      );

  if (
    normalized ===
    "CIENCIAS DA NATUREZA E SUAS TECNOLOGIAS"
  ) {
    return "Ciências da Natureza e suas Tecnologias";
  }

  if (
    normalized ===
    "CIENCIAS HUMANAS E SUAS TECNOLOGIAS"
  ) {
    return "Ciências Humanas e suas Tecnologias";
  }

  if (
    normalized ===
      "LINGUAGENS, CODIGOS E SUAS TECNOLOGIAS" ||
    normalized ===
      "LINGUAGENS E SUAS TECNOLOGIAS"
  ) {
    return "Linguagens, Códigos e suas Tecnologias";
  }

  if (
    normalized ===
    "MATEMATICA E SUAS TECNOLOGIAS"
  ) {
    return "Matemática e suas Tecnologias";
  }

  return null;
}

function inferAreaFromSubjectPath(
  subjectPath: readonly string[],
): string | null {
  const first =
    subjectPath[0]
      ?.normalize("NFKD")
      .replace(
        /[\u0300-\u036f]/g,
        "",
      )
      .toLocaleLowerCase(
        "pt-BR",
      ) ?? "";

  if (
    [
      "biologia",
      "fisica",
      "quimica",
    ].includes(first)
  ) {
    return "Ciências da Natureza e suas Tecnologias";
  }

  if (
    [
      "historia",
      "geografia",
      "filosofia",
      "sociologia",
    ].includes(first)
  ) {
    return "Ciências Humanas e suas Tecnologias";
  }

  if (
    first.includes(
      "matematica",
    )
  ) {
    return "Matemática e suas Tecnologias";
  }

  if (
    [
      "portugues",
      "lingua portuguesa",
      "literatura",
      "ingles",
      "espanhol",
      "artes",
      "educacao fisica",
    ].some(
      (value) =>
        first.includes(value),
    )
  ) {
    return "Linguagens, Códigos e suas Tecnologias";
  }

  return null;
}

function isAlternativeLabel(
  value: string,
): string | null {
  const match =
    /^([a-e])\s*\)$/i.exec(
      value.trim(),
    );

  return match
    ? match[1]!.toLocaleUpperCase(
        "pt-BR",
      )
    : null;
}

function isMetadataText(
  value: string,
): boolean {
  return (
    value.startsWith(
      "Disciplinas/Assuntos vinculados:",
    ) ||
    value.startsWith(
      "Fonte:",
    ) ||
    value.startsWith(
      "e Pesquisas Educacionais",
    )
  );
}

function normalizeTextParts(
  values: readonly string[],
): string {
  return values
    .map((value) =>
      value.trim(),
    )
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAnswerKey(
  pages: readonly PdfPage[],
): Map<number, string> {
  const answerKey =
    new Map<number, string>();

  const text = pages
    .flatMap((page) =>
      page.texts
        .slice()
        .sort(
          (first, second) =>
            first.top - second.top ||
            first.left - second.left,
        )
        .map(
          (span) => span.text,
        ),
    )
    .join(" ");

  const gabaritoIndex =
    text.indexOf("Gabarito");

  if (gabaritoIndex < 0) {
    return answerKey;
  }

  const answerText =
    text.slice(gabaritoIndex);

  for (
    const match of
    answerText.matchAll(
      /\((\d+)\s*=\s*([a-e])\)/gi,
    )
  ) {
    const ordinal =
      Number(match[1]);

    if (
      Number.isSafeInteger(
        ordinal,
      )
    ) {
      answerKey.set(
        ordinal,
        match[2]!.toLocaleUpperCase(
          "pt-BR",
        ),
      );
    }
  }

  return answerKey;
}

function questionBlocksFromPages(
  pages: readonly PdfPage[],
): MutableQuestionBlock[] {
  const blocks:
    MutableQuestionBlock[] = [];
  let active:
    | MutableQuestionBlock
    | null = null;

  for (const page of pages) {
    const texts =
      orderedPageTexts(page);
    const images =
      orderedPageImages(page);

    const gabaritoTop =
      texts.find(
        (span) =>
          span.text.trim() ===
          "Gabarito",
      )?.top ?? null;

    const markers = texts
      .map((span, index) => ({
        span,
        index,
        marker:
          questionMarker(
            span.text,
          ),
      }))
      .filter(
        (
          item,
        ): item is {
          span: PdfTextSpan;
          index: number;
          marker: {
            ordinal: number;
            providerQuestionId: string;
          };
        } =>
          item.marker !== null,
      );

    if (markers.length === 0) {
      if (active) {
        active.spans.push(
          ...texts.filter(
            (span) =>
              gabaritoTop === null ||
              span.top <
                gabaritoTop,
          ),
        );
        active.images.push(
          ...images.filter(
            (image) =>
              gabaritoTop === null ||
              image.top <
                gabaritoTop,
          ),
        );
      }

      if (
        gabaritoTop !== null
      ) {
        active = null;
      }

      continue;
    }

    const firstMarkerTop =
      markers[0]!.span.top;

    if (active) {
      active.spans.push(
        ...texts.filter(
          (span) =>
            span.top <
              firstMarkerTop &&
            (
              gabaritoTop === null ||
              span.top <
                gabaritoTop
            ),
        ),
      );
      active.images.push(
        ...images.filter(
          (image) =>
            image.top <
              firstMarkerTop &&
            (
              gabaritoTop === null ||
              image.top <
                gabaritoTop
            ),
        ),
      );
    }

    for (
      let markerIndex = 0;
      markerIndex <
      markers.length;
      markerIndex += 1
    ) {
      const current =
        markers[markerIndex]!;
      const next =
        markers[
          markerIndex + 1
        ];
      const endTop = Math.min(
        next?.span.top ??
          Number.POSITIVE_INFINITY,
        gabaritoTop ??
          Number.POSITIVE_INFINITY,
      );

      const block:
        MutableQuestionBlock = {
          ordinal:
            current.marker.ordinal,
          providerQuestionId:
            current.marker
              .providerQuestionId,
          spans: texts.filter(
            (span) =>
              span.top >=
                current.span.top &&
              span.top < endTop,
          ),
          images: images.filter(
            (image) =>
              image.top >=
                current.span.top &&
              image.top < endTop,
          ),
        };

      blocks.push(block);
      active = block;
    }

    if (
      gabaritoTop !== null
    ) {
      active = null;
    }
  }

  return blocks;
}

function parseQuestionBlock(
  block: MutableQuestionBlock,
  answerKey:
    ReadonlyMap<number, string>,
): ParsedQuestion {
  const spans = block.spans
    .slice()
    .sort(
      (first, second) =>
        first.page - second.page ||
        first.top - second.top ||
        first.left - second.left,
    );

  const allText =
    normalizeTextParts(
      spans.map(
        (span) => span.text,
      ),
    );

  const subjectLine =
    spans.find(
      (span) =>
        span.text.startsWith(
          "Disciplinas/Assuntos vinculados:",
        ),
    )?.text ?? "";

  const subjectPath =
    subjectLine
      .replace(
        /^Disciplinas\/Assuntos vinculados:\s*/,
        "",
      )
      .split(">")
      .map((item) =>
        item.trim(),
      )
      .filter(Boolean);

  const officialMatch =
    /Questão:\s*(\d+)/.exec(
      allText,
    );
  const officialQuestionNumber =
    officialMatch
      ? Number(
          officialMatch[1],
        )
      : null;

  const explicitArea =
    spans
      .map((span) =>
        stripQuestionMarker(
          span.text,
        ),
      )
      .find(isAreaHeading);

  const area =
    (
      explicitArea
        ? normalizeAreaHeading(
            explicitArea,
          )
        : null
    ) ??
    inferAreaFromSubjectPath(
      subjectPath,
    );

  const alternativeLabels =
    spans
      .map((span, index) => ({
        span,
        index,
        label:
          isAlternativeLabel(
            span.text,
          ),
      }))
      .filter(
        (
          item,
        ): item is {
          span: PdfTextSpan;
          index: number;
          label: string;
        } =>
          item.label !== null,
      );

  const alternatives =
    alternativeLabels.map(
      (current, index) => {
        const next =
          alternativeLabels[
            index + 1
          ];

        const contentSpans =
          spans.slice(
            current.index + 1,
            next?.index ??
              spans.length,
          )
          .filter(
            (span) =>
              !isMetadataText(
                span.text,
              ),
          )
          .filter(
            (span) =>
              !questionMarker(
                span.text,
              ),
          );

        const nextTopOnPage =
          next &&
          next.span.page ===
            current.span.page
            ? next.span.top
            : Number
                .POSITIVE_INFINITY;

        const imageCount =
          block.images.filter(
            (image) =>
              image.page ===
                current.span.page &&
              image.top >=
                current.span.top &&
              image.top <
                nextTopOnPage,
          ).length;

        return {
          label: current.label,
          content:
            normalizeTextParts(
              contentSpans.map(
                (span) =>
                  span.text,
              ),
            ),
          imageCount,
        };
      },
    );

  const firstAlternative =
    alternativeLabels[0];

  const statementSpans =
    spans
      .slice(
        0,
        firstAlternative?.index ??
          spans.length,
      )
      .map((span, index) => ({
        ...span,
        text:
          index === 0
            ? stripQuestionMarker(
                span.text,
              )
            : span.text,
      }))
      .filter(
        (span) =>
          span.text.length > 0,
      )
      .filter(
        (span) =>
          !isMetadataText(
            span.text,
          ),
      )
      .filter(
        (span) =>
          !isAreaHeading(
            span.text,
          ),
      );

  const statement =
    normalizeTextParts(
      statementSpans.map(
        (span) => span.text,
      ),
    );

  const startPage =
    Math.min(
      ...spans.map(
        (span) => span.page,
      ),
    );
  const endPage =
    Math.max(
      ...spans.map(
        (span) => span.page,
      ),
    );

  const hasBlankAlternative =
    alternatives.some(
      (alternative) =>
        alternative.content
          .trim().length === 0,
    );

  const visualCue =
    /\b(figura|gráfico|grafico|esquema|diagrama|tirinha|imagem|mapa|heredograma|cartaz|ilustração|ilustracao)\b/i.test(
      statement,
    );

  return {
    ordinal: block.ordinal,
    providerQuestionId:
      block.providerQuestionId,
    officialQuestionNumber:
      Number.isSafeInteger(
        officialQuestionNumber,
      )
        ? officialQuestionNumber
        : null,
    area,
    subjectPath,
    statement,
    alternatives,
    answerKey:
      answerKey.get(
        block.ordinal,
      ) ?? null,
    startPage,
    endPage,
    images:
      block.images,
    hasVisualCue:
      visualCue ||
      hasBlankAlternative ||
      block.images.length > 0,
    rawText: allText,
  };
}

export function parseEnemPdfDocument(
  input: Readonly<{
    xml: string;
    checksum: string;
  }>,
): ParsedDocument {
  const pages =
    parsePdftohtmlXml(
      input.xml,
    );
  const answerKey =
    parseAnswerKey(pages);
  const blocks =
    questionBlocksFromPages(
      pages,
    );
  const questions =
    blocks.map((block) =>
      parseQuestionBlock(
        block,
        answerKey,
      ),
    );

  const ordinals =
    new Set(
      questions.map(
        (question) =>
          question.ordinal,
      ),
    );
  const providerIds =
    new Set(
      questions.map(
        (question) =>
          question
            .providerQuestionId,
      ),
    );

  if (
    ordinals.size !==
      questions.length ||
    providerIds.size !==
      questions.length
  ) {
    throw new Error(
      "ENEM PDF contains duplicate question ordinals or provider IDs.",
    );
  }

  return {
    checksum:
      input.checksum,
    questions:
      questions.sort(
        (first, second) =>
          first.ordinal -
          second.ordinal,
      ),
  };
}

async function extractWithPdftohtml(
  input: Readonly<{
    pdfPath: string;
    binary: string;
  }>,
): Promise<ParsedDocument> {
  const pdfBuffer =
    await readFile(
      input.pdfPath,
    );
  const checksum =
    createHash("sha256")
      .update(pdfBuffer)
      .digest("hex");

  const workspace =
    await mkdtemp(
      join(
        tmpdir(),
        "soubizurado-enem-pdf-",
      ),
    );
  const outputPath =
    join(
      workspace,
      "document.xml",
    );

  try {
    await execFileAsync(
      input.binary,
      [
        "-xml",
        "-hidden",
        "-nodrm",
        "-enc",
        "UTF-8",
        input.pdfPath,
        outputPath,
      ],
      {
        windowsHide: true,
        maxBuffer:
          1024 * 1024 * 8,
      },
    );

    const xml =
      await readFile(
        outputPath,
        "utf8",
      );

    return parseEnemPdfDocument({
      xml,
      checksum,
    });
  } catch (error) {
    const code =
      (
        error as
          | NodeJS.ErrnoException
          | undefined
      )?.code;

    if (
      code === "ENOENT"
    ) {
      throw new Error(
        "pdftohtml was not found. Install Poppler and make sure pdftohtml is available in PATH.",
      );
    }

    throw error;
  } finally {
    await rm(
      workspace,
      {
        recursive: true,
        force: true,
      },
    );
  }
}

function validateYear(
  year: number,
): void {
  if (
    !Number.isSafeInteger(year) ||
    year < 2009 ||
    year > 2100
  ) {
    throw new Error(
      "ENEM PDF year must be between 2009 and 2100.",
    );
  }
}

export class EnemPdfProvider
  implements QuestionProvider
{
  private readonly sourceUrl: string;
  private readonly pdftohtmlBinary: string;
  private document:
    Promise<ParsedDocument> | null =
      null;

  public constructor(
    private readonly options:
      EnemPdfProviderOptions,
  ) {
    validateYear(
      options.year,
    );
    this.sourceUrl =
      options.sourceUrl ??
      GRAN_SIMULADO_URL;
    this.pdftohtmlBinary =
      options.pdftohtmlBinary ??
      "pdftohtml";
  }

  private loadDocument(): Promise<ParsedDocument> {
    if (!this.document) {
      this.document =
        this.options
          .extractDocument
          ? this.options
              .extractDocument({
                pdfPath:
                  this.options
                    .pdfPath,
                year:
                  this.options.year,
              })
          : extractWithPdftohtml({
              pdfPath:
                this.options
                  .pdfPath,
              binary:
                this.pdftohtmlBinary,
            });
    }

    return this.document;
  }

  public async inspect(): Promise<
    Readonly<{
      checksum: string;
      total: number;
      answerKeyCount: number;
      visualQuestionCount: number;
      blankAlternativeQuestionCount: number;
      officialNumberCount: number;
      ordinals: readonly number[];
    }>
  > {
    const document =
      await this.loadDocument();

    return {
      checksum:
        document.checksum,
      total:
        document.questions.length,
      answerKeyCount:
        document.questions.filter(
          (question) =>
            Boolean(
              question.answerKey,
            ),
        ).length,
      visualQuestionCount:
        document.questions.filter(
          (question) =>
            question.hasVisualCue,
        ).length,
      blankAlternativeQuestionCount:
        document.questions.filter(
          (question) =>
            question.alternatives
              .some(
                (alternative) =>
                  alternative
                    .content
                    .trim()
                    .length === 0,
              ),
        ).length,
      officialNumberCount:
        document.questions.filter(
          (question) =>
            question
              .officialQuestionNumber !==
            null,
        ).length,
      ordinals:
        document.questions.map(
          (question) =>
            question.ordinal,
        ),
    };
  }

  public async listQuestions(
    input: QuestionProviderListInput,
  ): Promise<QuestionProviderListResult> {
    const document =
      await this.loadDocument();
    const ordered =
      document.questions;

    let startIndex = 0;

    if (input.externalId) {
      const exactIndex =
        ordered.findIndex(
          (question) =>
            this.externalId(
              question,
            ) ===
            input.externalId,
        );

      if (exactIndex < 0) {
        return {
          total: ordered.length,
          nextCursor: null,
          correlationId: null,
          items: [],
        };
      }

      startIndex =
        exactIndex;
    } else if (
      input.afterId
    ) {
      const cursorIndex =
        ordered.findIndex(
          (question) =>
            this.externalId(
              question,
            ) ===
            input.afterId,
        );

      if (
        cursorIndex >= 0
      ) {
        startIndex =
          cursorIndex + 1;
      }
    }

    const selected =
      input.externalId
        ? ordered.slice(
            startIndex,
            startIndex + 1,
          )
        : ordered.slice(
            startIndex,
            startIndex +
              input.limit,
          );

    const items:
      ProviderQuestionCandidate[] =
        selected.map(
          (question) => ({
            externalId:
              this.externalId(
                question,
              ),
            number:
              question
                .officialQuestionNumber !==
              null
                ? String(
                    question
                      .officialQuestionNumber,
                  )
                : String(
                    question.ordinal,
                  ),
            statementHtml:
              question.statement,
            alternatives:
              question.alternatives.map(
                (alternative) => ({
                  label:
                    alternative.label,
                  contentHtml:
                    alternative.content,
                  imageUrls: [],
                }),
              ),
            answerKey:
              question.answerKey,
            examinationExternalIds: [
              `enem-${this.options.year}`,
            ],
            discipline:
              question.area,
            topic: null,
            supportTextsHtml: [],
            attachmentUrls: [],
            hasImages:
              question.hasVisualCue,
            hasAnswerKey:
              Boolean(
                question.answerKey,
              ),
            hasSupportText: false,
            sourceUrl:
              this.sourceUrl,
            rawPayload: {
              provider:
                "GRAN_ENEM_PDF",
              year:
                this.options.year,
              documentChecksum:
                document.checksum,
              ordinal:
                question.ordinal,
              providerQuestionId:
                question
                  .providerQuestionId,
              officialQuestionNumber:
                question
                  .officialQuestionNumber,
              subjectPath:
                question.subjectPath,
              area:
                question.area,
              startPage:
                question.startPage,
              endPage:
                question.endPage,
              answerKey:
                question.answerKey,
              images:
                question.images.map(
                  (image) => ({
                    page:
                      image.page,
                    top:
                      image.top,
                    left:
                      image.left,
                    width:
                      image.width,
                    height:
                      image.height,
                    sourceName:
                      image.src,
                  }),
                ),
              alternatives:
                question.alternatives,
              hasVisualCue:
                question.hasVisualCue,
              rawText:
                question.rawText,
            },
          }),
        );

    const nextCursor =
      input.externalId ||
      startIndex +
        selected.length >=
        ordered.length
        ? null
        : (
            selected.at(-1)
              ? this.externalId(
                  selected.at(-1)!,
                )
              : null
          );

    return {
      total:
        ordered.length,
      nextCursor,
      correlationId: null,
      items,
    };
  }

  private externalId(
    question: ParsedQuestion,
  ): string {
    return `enem-${this.options.year}-gran-${question.providerQuestionId.toLocaleLowerCase("pt-BR")}`;
  }

  public async getExamination(
    externalId: string,
  ): Promise<ProviderExaminationMetadata | null> {
    if (
      externalId !==
      `enem-${this.options.year}`
    ) {
      return null;
    }

    return {
      externalId,
      title:
        `ENEM ${this.options.year}`,
      slugPrefix: "enem",
      organization: "INEP",
      careerPosition: null,
      year:
        this.options.year,
      board: null,
      alternativeType:
        "MULTIPLA_ESCOLHA",
    };
  }
}
