import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import {
  examiningBoardSlug,
  suggestExaminingBoard,
} from "@/modules/question-bank/domain/examining-board-catalog";

import {
  type DetectedExamMetadata,
  OFFICIAL_EXAM_READERS,
  type OfficialExamAnalysis,
  type OfficialExamReader,
  type OfficialExamQuestion,
  questionKey,
} from "../../application/official-exams/official-exam";
import { findGridKeyBlock, parseAocpGridAnswerKey } from "../providers/aocp-grid-answer-key";
import {
  type AocpLine,
  answerFor,
  type AocpAnswerKey,
  parseAocpAnswerKey,
  parseAocpExam,
  readAocpLines,
  validateAocpExam,
} from "../providers/aocp-pdf-parser";
import {
  findRoleAnswers,
  parseAocpTrueFalseExam,
  parseSectionRanges,
  parseTrueFalseAnswerKeyBlocks,
  TRUE_FALSE_FORMAT,
  validateTrueFalseExam,
} from "../providers/aocp-true-false-parser";

import {
  isPdf,
  sha256,
  uploadPaths,
} from "./official-exam-upload-store";

const execFileAsync = promisify(execFile);

/** Removes aggregator watermarks (e.g. PCI Concursos) from extracted text. */
export function stripWatermarks(text: string): string {
  return text
    .split("\n")
    .filter((line) => !/pcimarkpci|www\.pciconcursos\.com\.br/i.test(line))
    .join("\n");
}

/** Detects the booklet layout (reader), not the examining board. */
export function detectBoard(coverText: string): OfficialExamReader | null {
  if (/instituto\s+aocp|institutoaocp|(?<![a-z])aocp(?![a-z])/i.test(coverText)) return "AOCP";
  if (/fundatec/i.test(coverText)) return "FUNDATEC";
  if (/cebraspe|cespe/i.test(coverText)) return "CEBRASPE";
  return null;
}

/** Best-effort metadata from the booklet cover; the reviewer confirms it. */
export function detectMetadata(coverText: string): DetectedExamMetadata {
  const lines = coverText
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const noticeLines = lines.filter((line) => /\b(edital|portaria)\b/i.test(line));
  const noticeLine =
    noticeLines.find((line) => /\b20\d{2}\b/.test(line)) ?? noticeLines[0] ?? null;
  const year =
    noticeLine?.match(/\b(20\d{2})\b/)?.[1] ??
    coverText.match(/\b(?:edital|concurso)[^\n]{0,60}?\b(20\d{2})\b/i)?.[1] ??
    null;

  const level =
    coverText.match(/\bn[ií]vel\b[\s\S]{0,40}?\b(fundamental|m[ée]dio|intermedi[aá]rio|superior)\b/i)?.[1] ?? null;

  // Institution names first: role lines also contain " - " (e.g.
  // "TRADUTOR E INTÉRPRETE DE LINGUAGEM DE SINAIS - LIBRAS").
  const organizationLine =
    lines.find(
      (line) =>
        /\b(universidade|instituto federal|prefeitura|c[aâ]mara municipal)\b/i.test(line) &&
        !/edital|portaria/i.test(line),
    ) ??
    lines.find((line) => /\s[–-]\s/.test(line) && /[A-ZÁÉÍÓÚ]{3,}/.test(line) && !/edital|portaria/i.test(line)) ??
    lines.find((line) => /secretaria|pol[ií]cia|assembleia|tribunal|minist[ée]rio/i.test(line)) ??
    null;

  // AOCP covers print the role right above "Nível", after the booklet
  // code ("M1397001N") or the notice line; it may span two lines
  // ("POLICIAL PENAL" + "(FEMININO E MASCULINO)").
  const levelIndex = lines.findIndex((line) => /^n[ií]vel$/i.test(line));
  const roleLines: string[] = [];

  for (let index = levelIndex - 1; index >= 0 && roleLines.length < 2; index -= 1) {
    const line = lines[index]!;
    const isRole =
      line.length >= 3 &&
      line.length <= 90 &&
      line === line.toLocaleUpperCase("pt-BR") &&
      /[A-ZÀ-Ý]{3,}/.test(line) &&
      !/^[A-Z]\d{6,8}[A-Z]?$/.test(line) &&
      !/edital|portaria|governo|concurso/i.test(line) &&
      line !== organizationLine;

    if (!isRole) {
      break;
    }

    roleLines.unshift(line);
  }

  // 2019-2020 covers have no "Nível" line: the organization is the line right
  // above "EDITAL ..." and the position(s) the uppercase lines right below it.
  const editalIndex = lines.findIndex((line) => /^edital\b/i.test(line));
  const layout2019 = levelIndex <= 0 && editalIndex > 0;
  const coverNoise = /^(nome do candidato|inscri[cç][aã]o|composi[cç][aã]o do caderno)$/i;

  if (layout2019) {
    const above = lines
      .slice(Math.max(0, editalIndex - 2), editalIndex)
      .reverse()
      .find((line) => !coverNoise.test(line));

    for (let index = editalIndex + 1; index < lines.length && roleLines.length < 2; index += 1) {
      const line = lines[index]!;

      if (coverNoise.test(line) || line !== line.toLocaleUpperCase("pt-BR") || line.length > 90) {
        break;
      }

      roleLines.push(line);
    }

    return {
      organization: above ? above.replace(/\s+ESTADO D[EOA]\s.+$/, "").replace(/\s+CONCURSO P[ÚU]BLICO.*$/, "").trim() : null,
      careerPosition: roleLines.length > 0 ? roleLines.join(" ") : null,
      year: year ? Number(year) : null,
      level: level ? level[0]!.toUpperCase() + level.slice(1).toLowerCase() : null,
      notice: noticeLine,
    };
  }

  return {
    organization: organizationLine,
    careerPosition: levelIndex > 0 && roleLines.length > 0 ? roleLines.join(" ") : null,
    year: year ? Number(year) : null,
    level: level ? level[0]!.toUpperCase() + level.slice(1).toLowerCase() : null,
    notice: noticeLine,
  };
}

/**
 * The V/F answer key lists every role; the booklet role is the cover
 * line that matches exactly one role block.
 */
function analyzeAocpTrueFalse(
  xml: string,
  coverText: string,
  answerText: string,
  layoutCoverText: string,
): Readonly<{
  sections: readonly string[];
  questions: OfficialExamQuestion[];
  issues: string[];
  role: string | null;
}> {
  // The composition table is read line by line; in some covers the plain text
  // lists the names and the ranges apart, the layout text keeps them together.
  const plainRanges = parseSectionRanges(coverText);
  const ranges = plainRanges.length >= 2 ? plainRanges : parseSectionRanges(layoutCoverText);
  const exam = parseAocpTrueFalseExam(readAocpLines(xml, { headerMaxTop: 30 }), ranges);
  const issues = validateTrueFalseExam(exam, ranges.at(-1)?.to ?? null);
  const blocks = parseTrueFalseAnswerKeyBlocks(answerText);

  const roles = [
    ...new Set(
      coverText
        .split("\n")
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter((line) => line.length >= 5 && findRoleAnswers(blocks, line).answers !== null),
    ),
  ];

  const role = roles.length === 1 ? roles[0]! : null;
  let answers = role ? findRoleAnswers(blocks, role).answers : null;
  let byVersion = false;

  // 2016-style Certo/Errado keys list "Prova 01..04" only, with C/E letters.
  if (!role && roles.length === 0) {
    const gridBlocks = parseAocpGridAnswerKey(answerText);

    if (gridBlocks.length > 0) {
      const hints = coverPositionHints(coverText);
      const match = findGridKeyBlock(gridBlocks, hints.candidates, hints.exam);

      if (match.ok) {
        answers = new Map([...match.answers].map(([number, letter]) => [number, letter === "X" ? "ANNULLED" : letter === "C" ? "V" : "F"] as const));
        byVersion = true;
      }
    }
  }

  if (!role && !byVersion) {
    issues.push(
      roles.length > 1
        ? `Cargo ambíguo no gabarito: ${roles.join("; ")}.`
        : "O cargo do caderno não foi encontrado no gabarito.",
    );
  }

  const questions = exam.items.map((item): OfficialExamQuestion => {
    const answer = answers?.get(item.number) ?? null;

    if (answers && answer === null) {
      issues.push(`Item ${item.number}: sem resposta no gabarito.`);
    }

    return {
      key: questionKey(item.number, 0),
      number: item.number,
      variant: 0,
      block: null,
      section: item.section,
      type: "TRUE_FALSE",
      // The group command makes each item self-contained.
      statement: item.command ? `${item.command}\n\n${item.statement}` : item.statement,
      images: item.images,
      supportText: item.supportText,
      supportImages: item.supportImages,
      alternatives: [],
      answer: answer === "V" || answer === "F" ? answer : null,
      annulled: answer === "ANNULLED",
      refersToHighlight: item.refersToHighlight,
    };
  });

  if (answers && answers.size !== exam.items.length) {
    issues.push(`O gabarito do cargo tem ${answers.size} respostas para ${exam.items.length} itens.`);
  }

  return { sections: exam.sections, questions, issues, role };
}

async function pdfToText(path: string, lastPage?: number, layout = false): Promise<string> {
  const args = ["-enc", "UTF-8", ...(layout ? ["-layout"] : []), ...(lastPage ? ["-l", String(lastPage)] : []), path, "-"];
  const { stdout } = await execFileAsync("pdftotext", args, {
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 32,
  });

  return stripWatermarks(stdout);
}

/** Cover lines that may name the position, and the "Prova N" variant printed on the cover. */
function coverPositionHints(coverText: string): Readonly<{ candidates: string[]; exam: number | null }> {
  const lines = coverText
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 4 && line.length <= 90);
  const exam = /\bprova\s*0?(\d)\b/i.exec(coverText.replace(/\s+/g, " "));

  return { candidates: lines, exam: exam ? Number(exam[1]) : null };
}

/**
 * Some PDFs bind several versions of the same exam ("Prova 1..4"), each with its
 * own cover page (a huge "PROVA" label). Only the lines of the version on the
 * first cover are read: headings and numbering restart in every version.
 */
function selectBoundVersion(lines: readonly AocpLine[], version: number): readonly AocpLine[] {
  const covers = [...new Set(lines.filter((line) => line.bold && line.size >= 30 && /^prova$/i.test(line.text)).map((line) => line.page))].sort(
    (left, right) => left - right,
  );

  if (covers.length < 2) {
    return lines;
  }

  // Version 0 runs up to the second cover; version k starts after cover k.
  const from = version === 0 ? 2 : (covers[version - 1] ?? 2) + 1;
  const to = covers[version] ?? Number.POSITIVE_INFINITY;

  return lines.filter((line) => line.page >= from && line.page < to);
}

/** Grid-style keys (2016-2020 AOCP) list every position; the booklet's one is found by its cover. */
function gridKeyFor(answerText: string, coverText: string): Readonly<{ key: AocpAnswerKey; issue: string | null }> | null {
  const blocks = parseAocpGridAnswerKey(answerText);

  if (blocks.length === 0) {
    return null;
  }

  const hints = coverPositionHints(coverText);
  const match = findGridKeyBlock(blocks, hints.candidates, hints.exam);

  if (!match.ok) {
    return { key: new Map(), issue: match.reason };
  }

  return {
    key: new Map([...match.answers].map(([number, letter]) => [number, [letter === "X" ? "ANNULLED" : letter]] as const)),
    issue: null,
  };
}

function analyzeAocp(xml: string, answerText: string, coverText: string): Readonly<{
  sections: readonly string[];
  questions: OfficialExamQuestion[];
  issues: string[];
}> {
  // 2019-2020 booklets print the number inline ("<b>3. </b>") and start the
  // content right at the top of the page, so the header zone must be smaller.
  const inlineNumbers = /<b>\d{1,3}\.\s*<\/b>/.test(xml);
  const grid = gridKeyFor(answerText, coverText);
  const allLines = readAocpLines(xml, inlineNumbers ? { headerMaxTop: 30 } : {});
  const parsedExam = parseAocpExam(selectBoundVersion(allLines, (coverPositionHints(coverText).exam ?? 1) - 1));
  // Some booklets bind several "Prova 1..4" versions of the same exam (same
  // questions in another order). Only the version on the cover is imported.
  const versions = Math.max(0, ...parsedExam.questions.map((question) => question.variant)) + 1;
  const coverVersion = (coverPositionHints(coverText).exam ?? 1) - 1;
  const exam =
    grid && versions >= 3
      ? {
          ...parsedExam,
          questions: parsedExam.questions.filter((question) => question.variant === coverVersion).map((question) => ({ ...question, variant: 0 })),
        }
      : parsedExam;
  const key = grid ? grid.key : parseAocpAnswerKey(answerText);
  const issues = validateAocpExam(exam);

  if (grid?.issue) {
    issues.push(grid.issue);
  }

  const questions = exam.questions.map((question): OfficialExamQuestion => {
    const answer = answerFor(key, question);

    if (answer === null) {
      // With no position in the key every question would repeat the same message.
      if (!grid?.issue) {
        issues.push(`Questão ${questionKey(question.number, question.variant)}: sem resposta no gabarito.`);
      }
    }

    return {
      key: questionKey(question.number, question.variant),
      number: question.number,
      variant: question.variant,
      block: question.block,
      section: question.section,
      type: "MULTIPLE_CHOICE",
      statement: question.statement,
      images: question.images,
      supportText: question.supportText,
      supportImages: question.supportImages,
      alternatives: question.alternatives,
      answer: answer === "ANNULLED" ? null : answer,
      annulled: answer === "ANNULLED",
      refersToHighlight: question.refersToHighlight,
    };
  });

  if (questions.length === 0) {
    issues.push("Nenhuma questão encontrada no caderno.");
  }

  // The cover announces the composition ("01 a 10", "11 a 15"...): the last
  // number is the size of the exam. Booklets with optional-language blocks
  // reuse numbers, so only single-version ones are checked.
  const announced = Math.max(
    0,
    ...[...coverText.matchAll(/\b(\d{1,3})\s+a\s+(\d{1,3})\b/g)].filter((range) => Number(range[1]) < Number(range[2])).map((range) => Number(range[2])),
  );

  if (announced >= 5 && questions.length > 0 && !questions.some((question) => question.variant > 0) && questions.length !== announced) {
    issues.push(`O caderno anuncia ${announced} questões, mas foram lidas ${questions.length}.`);
  }

  return { sections: exam.sections, questions, issues };
}

/**
 * Extracts, parses and matches the uploaded booklet with its answer
 * key. Writes extracted images into the upload workspace.
 */
export async function analyzeOfficialExam(
  uploadId: string,
  fileNames: Readonly<{ booklet: string; answerKey: string }>,
): Promise<OfficialExamAnalysis> {
  const paths = uploadPaths(uploadId);
  const [bookletBytes, answerKeyBytes] = await Promise.all([
    readFile(paths.booklet),
    readFile(paths.answerKey),
  ]);

  const coverText = await pdfToText(paths.booklet, 2);
  const detectedBoard = detectBoard(coverText);
  const board: OfficialExamReader | null =
    detectedBoard === "AOCP" && TRUE_FALSE_FORMAT.test(coverText) ? "AOCP_VF" : detectedBoard;
  const suggestion = suggestExaminingBoard(coverText);

  const base = {
    version: 1 as const,
    uploadId: uploadId.toLowerCase(),
    createdAt: new Date().toISOString(),
    board,
    suggestedBoardSlug: suggestion ? examiningBoardSlug(suggestion.name) : null,
    bookletChecksum: sha256(bookletBytes),
    answerKeyChecksum: sha256(answerKeyBytes),
    bookletFileName: fileNames.booklet,
    answerKeyFileName: fileNames.answerKey,
    detected: detectMetadata(coverText),
  };

  if (board !== "AOCP" && board !== "AOCP_VF") {
    return {
      ...base,
      sections: [],
      questions: [],
      blockingIssues: [
        board
          ? `A leitura automática do ${OFFICIAL_EXAM_READERS[board]} ainda não está disponível. Por enquanto, apenas cadernos no formato AOCP são suportados.`
          : "Não foi possível identificar o formato do caderno pela capa da prova.",
      ],
    };
  }

  await execFileAsync(
    "pdftohtml",
    ["-xml", "-hidden", "-nodrm", "-enc", "UTF-8", paths.booklet, "document"],
    { cwd: paths.workspace, windowsHide: true, maxBuffer: 1024 * 1024 * 32 },
  );

  const xml = stripWatermarks(await readFile(join(paths.workspace, "document.xml"), "utf8"));
  // The answer key is the board's PDF or its plain text from the official results page.
  const answerText = isPdf(answerKeyBytes) ? await pdfToText(paths.answerKey) : Buffer.from(answerKeyBytes).toString("utf8");

  if (board === "AOCP_VF") {
    const coverOnly = await pdfToText(paths.booklet, 1);
    const parsed = analyzeAocpTrueFalse(xml, coverOnly, answerText, await pdfToText(paths.booklet, 1, true));

    return {
      ...base,
      detected: { ...base.detected, careerPosition: parsed.role ?? base.detected.careerPosition },
      sections: parsed.sections,
      questions: parsed.questions,
      blockingIssues: parsed.issues,
    };
  }

  const parsed = analyzeAocp(xml, answerText, coverText);

  return {
    ...base,
    sections: parsed.sections,
    questions: parsed.questions,
    blockingIssues: parsed.issues,
  };
}
