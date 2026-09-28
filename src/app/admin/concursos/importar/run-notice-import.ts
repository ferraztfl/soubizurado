import { buildContestSummary, buildNewsDraft } from "@/modules/contests/domain/notice-drafts";
import { matchBoard, toNoticeSuggestion } from "@/modules/contests/domain/notice-extraction";
import { cleanNoticeText, groundExtraction, mergeNoticeFacts, readNoticeTextFacts } from "@/modules/contests/domain/notice-text-facts";
import { estimatePromptTokens } from "@/modules/contests/domain/import-progress";
import { setJobPhase, type NoticeImportJob } from "@/modules/contests/infrastructure/notice-import-jobs";
import {
  extractNoticeFacts,
  extractNoticeFactsLocal,
  localAiSpeeds,
  NoticeReadError,
  readNoticePdf,
} from "@/modules/contests/infrastructure/notice-reader";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import type { ContestFormValues } from "../contest-form";
import { contestFormValues, EMPTY_CONTEST_FORM_VALUES } from "../contest-form-values";
import type { NoticeImportResult } from "./import-types";

export type NoticeImportInput = Readonly<{
  file: File;
  officialUrl: string | null;
  existingContestId: string | null;
}>;

/** Online models read fast; this only feeds the progress bar. */
const REMOTE_READING_MS = 25_000;

/**
 * The whole import (PDF → text → AI → checks → form values), reporting its
 * phase on the job. Never writes to the database.
 */
export async function runNoticeImport(job: NoticeImportJob<NoticeImportResult>, input: NoticeImportInput): Promise<void> {
  const started = Date.now();

  try {
    const prisma = getPrismaClient();
    const existing = input.existingContestId
      ? await prisma.contest.findUnique({ where: { id: input.existingContestId }, include: { contestPositions: true } })
      : null;

    setJobPhase(job, "pdf");
    // Browser-printed PDFs repeat a date/time header on every page: remove it before any date search.
    const text = cleanNoticeText(await readNoticePdf(input.file));
    const boards = await prisma.examiningBoard.findMany({ where: { isActive: true }, select: { id: true, name: true } });
    // Rules first: header data read straight from the text (no AI).
    const textFacts = readNoticeTextFacts(
      text,
      boards.map((board) => board.name),
    );

    setJobPhase(job, "excerpts");
    const { extraction, inputTokens, outputTokens } =
      job.provider === "none"
        ? { extraction: {}, inputTokens: 0, outputTokens: 0 }
        : job.provider === "remote"
        ? await (async () => {
            setJobPhase(job, "reading", { expectedReadingMs: REMOTE_READING_MS });
            return extractNoticeFacts(text, input.officialUrl);
          })()
        : await extractNoticeFactsLocal(text, input.officialUrl, (progress) => {
            if (progress.phase === "reading") {
              const expected = (progress.promptTokens / Math.max(localAiSpeeds().reading, 1)) * 1000;
              setJobPhase(job, "reading", { expectedReadingMs: Math.round(expected) });
            } else {
              setJobPhase(job, "writing", { generatedTokens: progress.generatedTokens });
            }
          });

    setJobPhase(job, "checking");
    // Keep only what the notice says, then complete with the rule facts.
    const grounded = groundExtraction(extraction, text);
    const extracted = toNoticeSuggestion(mergeNoticeFacts(grounded.extraction, textFacts), { noticeText: text });
    // The local model only extracts facts: summary and news come from our template.
    const suggestion = {
      ...extracted,
      summary: extracted.summary || buildContestSummary(extracted),
      news: extracted.news ?? buildNewsDraft(extracted),
      warnings: extracted.warnings.filter((warning) => !warning.includes("rascunho da notícia")),
    };

    const board = matchBoard(boards, suggestion.boardName);
    const warnings = [...suggestion.warnings];
    if (grounded.dropped.length > 0) {
      warnings.push(`Descartado por não aparecer no edital: ${grounded.dropped.join(", ")}.`);
    }
    if (!suggestion.registrationEnd) warnings.push("Datas de inscrição não encontradas no PDF — preencha pelo cronograma oficial.");
    if (!suggestion.examDate) warnings.push("Data da prova não encontrada no PDF — preencha pelo cronograma oficial.");
    if (!suggestion.positionLines) warnings.push("Cargos não identificados — preencha a lista de cargos.");
    if (suggestion.boardName && !board) {
      warnings.push(`Banca "${suggestion.boardName}" não está no catálogo; escolha a banca manualmente (ou cadastre-a em Bancas).`);
    }

    // An existing contest keeps what the notice does not say.
    const base = existing ? contestFormValues(existing) : EMPTY_CONTEST_FORM_VALUES;
    const pick = (value: string, fallback: string) => (value ? value : fallback);

    const values: ContestFormValues = {
      ...base,
      name: pick(suggestion.name, base.name),
      organizationName: pick(suggestion.organizationName, base.organizationName),
      stateCode: suggestion.stateCode ?? base.stateCode,
      status: suggestion.status,
      vacancies: pick(suggestion.vacancies, base.vacancies),
      hasReserveList: suggestion.hasReserveList || base.hasReserveList,
      salaryMin: pick(suggestion.salaryMin, base.salaryMin),
      salaryMax: pick(suggestion.salaryMax, base.salaryMax),
      educationLevels: suggestion.educationLevels.length > 0 ? suggestion.educationLevels : base.educationLevels,
      summary: pick(suggestion.summary, base.summary),
      registrationStart: pick(suggestion.registrationStart, base.registrationStart),
      registrationEnd: pick(suggestion.registrationEnd, base.registrationEnd),
      examDate: pick(suggestion.examDate, base.examDate),
      noticeUrl: input.officialUrl ?? base.noticeUrl,
      boardId: board?.id ?? base.boardId,
      positionLines: pick(suggestion.positionLines, base.positionLines),
      feeText: pick(suggestion.feeText, base.feeText),
      stages: pick(suggestion.stages, base.stages),
      examLocations: pick(suggestion.examLocations, base.examLocations),
    };

    job.result = {
      key: job.id,
      values,
      news: suggestion.news,
      warnings,
      usage: { inputTokens, outputTokens, provider: job.provider, seconds: Math.round((Date.now() - started) / 1000) },
    };
    setJobPhase(job, "done", { finishedAt: Date.now() });
  } catch (error) {
    job.error = error instanceof NoticeReadError ? error.message : "Erro inesperado ao ler o edital. Tente de novo.";
    setJobPhase(job, "error", { finishedAt: Date.now() });
    if (!(error instanceof NoticeReadError)) console.error("notice import failed", error);
  }
}

/** Rough reading estimate before the AI starts (used for the first progress values). */
export function initialReadingEstimateMs(fileSizeBytes: number): number {
  // Text is roughly 1 char per 2 bytes of PDF; the local AI gets at most ~18k chars.
  const characters = Math.min(fileSizeBytes / 2, 18_000);
  return Math.round((estimatePromptTokens(characters) / Math.max(localAiSpeeds().reading, 1)) * 1000);
}
