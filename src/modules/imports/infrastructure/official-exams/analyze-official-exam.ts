import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import {
  type DetectedExamMetadata,
  type OfficialExamAnalysis,
  type OfficialExamBoard,
  type OfficialExamQuestion,
  questionKey,
} from "../../application/official-exams/official-exam";
import {
  answerFor,
  parseAocpAnswerKey,
  parseAocpExam,
  readAocpLines,
  validateAocpExam,
} from "../providers/aocp-pdf-parser";

import {
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

export function detectBoard(coverText: string): OfficialExamBoard | null {
  if (/instituto\s+aocp|institutoaocp/i.test(coverText)) return "AOCP";
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
    coverText.match(/\bn[ií]vel\b[\s\S]{0,40}?\b(fundamental|m[ée]dio|superior)\b/i)?.[1] ?? null;

  const organizationLine =
    lines.find((line) => /\s[–-]\s/.test(line) && /[A-ZÁÉÍÓÚ]{3,}/.test(line) && !/edital|portaria/i.test(line)) ??
    lines.find((line) => /secretaria|pol[ií]cia|assembleia|tribunal|minist[ée]rio/i.test(line)) ??
    null;

  return {
    organization: organizationLine,
    careerPosition: null,
    year: year ? Number(year) : null,
    level: level ? level[0]!.toUpperCase() + level.slice(1).toLowerCase() : null,
    notice: noticeLine,
  };
}

async function pdfToText(path: string, lastPage?: number): Promise<string> {
  const args = ["-enc", "UTF-8", ...(lastPage ? ["-l", String(lastPage)] : []), path, "-"];
  const { stdout } = await execFileAsync("pdftotext", args, {
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 32,
  });

  return stripWatermarks(stdout);
}

function analyzeAocp(xml: string, answerText: string): Readonly<{
  sections: readonly string[];
  questions: OfficialExamQuestion[];
  issues: string[];
}> {
  const exam = parseAocpExam(readAocpLines(xml));
  const key = parseAocpAnswerKey(answerText);
  const issues = validateAocpExam(exam);

  const questions = exam.questions.map((question): OfficialExamQuestion => {
    const answer = answerFor(key, question);

    if (answer === null) {
      issues.push(`Questão ${questionKey(question.number, question.variant)}: sem resposta no gabarito.`);
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
  const board = detectBoard(coverText);

  const base = {
    version: 1 as const,
    uploadId: uploadId.toLowerCase(),
    createdAt: new Date().toISOString(),
    board,
    bookletChecksum: sha256(bookletBytes),
    answerKeyChecksum: sha256(answerKeyBytes),
    bookletFileName: fileNames.booklet,
    answerKeyFileName: fileNames.answerKey,
    detected: detectMetadata(coverText),
  };

  if (board !== "AOCP") {
    return {
      ...base,
      sections: [],
      questions: [],
      blockingIssues: [
        board
          ? `A leitura automática da banca ${board} ainda não está disponível. Por enquanto, apenas provas do Instituto AOCP são suportadas.`
          : "Não foi possível identificar a banca pela capa da prova.",
      ],
    };
  }

  await execFileAsync(
    "pdftohtml",
    ["-xml", "-hidden", "-nodrm", "-enc", "UTF-8", paths.booklet, "document"],
    { cwd: paths.workspace, windowsHide: true, maxBuffer: 1024 * 1024 * 32 },
  );

  const xml = stripWatermarks(await readFile(join(paths.workspace, "document.xml"), "utf8"));
  const answerText = await pdfToText(paths.answerKey);
  const parsed = analyzeAocp(xml, answerText);

  return {
    ...base,
    sections: parsed.sections,
    questions: parsed.questions,
    blockingIssues: parsed.issues,
  };
}
