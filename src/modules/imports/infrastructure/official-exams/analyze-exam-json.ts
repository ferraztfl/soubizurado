import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import {
  EXAMINING_BOARD_CATALOG,
  examiningBoardSlug,
  suggestExaminingBoard,
} from "@/modules/question-bank/domain/examining-board-catalog";

import {
  examJsonImageRefs,
  examJsonToQuestions,
  imageRefFileName,
  parseExamJson,
  validateExamJson,
  type ExamJsonImageRef,
} from "../../application/official-exams/exam-json";
import type { OfficialExamAnalysis } from "../../application/official-exams/official-exam";

import { sha256, uploadPaths } from "./official-exam-upload-store";

const execFileAsync = promisify(execFile);

/** Crop resolution: sharp enough for figures, small enough for storage. */
const CROP_DPI = 150;
/** Extra margin around each box (fraction of the page), boxes are approximate. */
const CROP_PADDING = 0.006;

async function pageSizePoints(pdf: string, page: number): Promise<{ width: number; height: number }> {
  const { stdout } = await execFileAsync("pdfinfo", ["-f", String(page), "-l", String(page), pdf], {
    windowsHide: true,
  });
  const match = stdout.match(/Page\s+\d+\s+size:\s+([\d.]+)\s+x\s+([\d.]+)/);

  if (!match) {
    throw new Error(`Página ${page} não existe no PDF enviado.`);
  }

  return { width: Number(match[1]), height: Number(match[2]) };
}

/** Crops one [ymin, xmin, ymax, xmax] (0–1000) region to a PNG in the workspace. */
async function cropImage(pdf: string, workspace: string, ref: ExamJsonImageRef): Promise<void> {
  const size = await pageSizePoints(pdf, ref.page);
  const pixels = { width: (size.width / 72) * CROP_DPI, height: (size.height / 72) * CROP_DPI };
  const [ymin, xmin, ymax, xmax] = ref.box.map((value) => value / 1000) as [number, number, number, number];
  const left = Math.max(0, xmin - CROP_PADDING);
  const top = Math.max(0, ymin - CROP_PADDING);
  const right = Math.min(1, xmax + CROP_PADDING);
  const bottom = Math.min(1, ymax + CROP_PADDING);
  const output = join(workspace, imageRefFileName(ref).replace(/\.png$/, ""));

  await execFileAsync(
    "pdftoppm",
    [
      "-f", String(ref.page),
      "-l", String(ref.page),
      "-r", String(CROP_DPI),
      "-x", String(Math.floor(left * pixels.width)),
      "-y", String(Math.floor(top * pixels.height)),
      "-W", String(Math.ceil((right - left) * pixels.width)),
      "-H", String(Math.ceil((bottom - top) * pixels.height)),
      "-png",
      "-singlefile",
      pdf,
      output,
    ],
    { windowsHide: true },
  );
}

function suggestBoardSlug(board: string): string | null {
  const bySlug = EXAMINING_BOARD_CATALOG.find((entry) => examiningBoardSlug(entry.name) === examiningBoardSlug(board));
  const entry = bySlug ?? suggestExaminingBoard(board);

  return entry ? examiningBoardSlug(entry.name) : null;
}

/**
 * Reads an uploaded "SouBizurado Exam JSON", validates it, crops the
 * referenced images from the booklet PDF and returns the same analysis
 * shape as the PDF readers, so preview and import are shared.
 */
export async function analyzeExamJson(
  uploadId: string,
  fileNames: Readonly<{ json: string; booklet: string | null }>,
): Promise<OfficialExamAnalysis> {
  const paths = uploadPaths(uploadId);
  const bytes = await readFile(paths.examJson);
  const checksum = sha256(bytes);

  const base = {
    version: 1 as const,
    uploadId: uploadId.toLowerCase(),
    createdAt: new Date().toISOString(),
    board: "JSON" as const,
    bookletChecksum: checksum,
    answerKeyChecksum: checksum,
    bookletFileName: fileNames.json,
    // The answer key travels inside the JSON; the PDF only feeds images.
    answerKeyFileName: fileNames.booklet ? `incluído no JSON (imagens de ${fileNames.booklet})` : "incluído no JSON",
  };

  const empty = { organization: null, careerPosition: null, year: null, level: null, notice: null };

  let raw: unknown;

  try {
    raw = JSON.parse(bytes.toString("utf8"));
  } catch {
    return { ...base, suggestedBoardSlug: null, detected: empty, sections: [], questions: [], blockingIssues: ["O arquivo não é um JSON válido."] };
  }

  const parsed = parseExamJson(raw);

  if (!parsed.ok) {
    return {
      ...base,
      suggestedBoardSlug: null,
      detected: empty,
      sections: [],
      questions: [],
      blockingIssues: parsed.errors.map((error) => `Formato: ${error}`),
    };
  }

  const exam = parsed.value;
  const issues = validateExamJson(exam);
  const refs = examJsonImageRefs(exam);

  if (refs.length > 0) {
    const hasBooklet = await access(paths.booklet).then(
      () => true,
      () => false,
    );

    if (!hasBooklet) {
      issues.push(`O JSON referencia ${refs.length} imagem(ns); envie também o PDF do caderno para recortá-las.`);
    } else {
      const unique = new Map(refs.map((ref) => [imageRefFileName(ref), ref]));

      for (const ref of unique.values()) {
        try {
          await cropImage(paths.booklet, paths.workspace, ref);
        } catch (error) {
          issues.push(
            `Imagem da página ${ref.page}: ${error instanceof Error ? error.message.slice(0, 120) : "falha ao recortar"}.`,
          );
        }
      }
    }
  }

  const questions = examJsonToQuestions(exam);

  return {
    ...base,
    suggestedBoardSlug: suggestBoardSlug(exam.exam.board),
    detected: {
      organization: exam.exam.organization,
      careerPosition: exam.exam.role,
      year: exam.exam.year,
      level: exam.exam.level,
      notice: exam.exam.notice,
    },
    sections: [...new Set(questions.map((question) => question.section).filter((section): section is string => Boolean(section)))],
    questions,
    blockingIssues: issues,
  };
}
