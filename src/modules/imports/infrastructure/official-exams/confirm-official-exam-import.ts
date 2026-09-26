import { z } from "zod";

import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import type { OfficialExamReader } from "../../application/official-exams/official-exam";
import {
  resolveExamSection,
  type SectionResolution,
} from "../../application/official-exams/resolve-exam-section";

import { loadAnalysis, type OfficialExamImportResult } from "./official-exam-upload-store";
import { loadSectionTaxonomyEntries, runOfficialExamImport } from "./run-official-exam-import";

/*
 * Confirms an analyzed upload: validates the exam metadata, resolves the
 * examining board from the catalog and the section → taxonomy mapping,
 * then runs the standard import. Shared by the single-exam preview and
 * the batch queue so both follow exactly the same rules.
 */

const metadataSchema = z.object({
  organization: z.string().trim().min(2, "Informe o órgão.").max(200),
  careerPosition: z.string().trim().min(2, "Informe o cargo.").max(180),
  year: z.coerce.number().int().min(1990, "Ano inválido.").max(2100, "Ano inválido."),
  level: z.string().trim().max(40).optional(),
  notice: z.string().trim().max(160).optional(),
  title: z.string().trim().max(240).optional(),
});

export type ConfirmOfficialExamInput = Readonly<{
  uploadId: string;
  boardSlug: string;
  organization: unknown;
  careerPosition: unknown;
  year: unknown;
  level?: unknown;
  notice?: unknown;
  title?: unknown;
  /**
   * Per section name: "auto", "discipline:<name>" or "area:<slug>".
   * Missing sections use the automatic resolution.
   */
  sectionChoices?: Readonly<Record<string, string>>;
}>;

/** Errors meant to be shown to the administrator as they are. */
export class ConfirmOfficialExamError extends Error {}

function optional(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export async function confirmOfficialExamImport(input: ConfirmOfficialExamInput): Promise<OfficialExamImportResult> {
  const analysis = await loadAnalysis(input.uploadId);

  if (!analysis?.board) {
    throw new ConfirmOfficialExamError("Análise indisponível para este envio.");
  }

  if (analysis.blockingIssues.length > 0) {
    throw new ConfirmOfficialExamError("A análise tem pendências que impedem a importação.");
  }

  const parsed = metadataSchema.safeParse({
    organization: input.organization,
    careerPosition: input.careerPosition,
    year: input.year,
    level: optional(input.level),
    notice: optional(input.notice),
    title: optional(input.title),
  });

  if (!parsed.success) {
    throw new ConfirmOfficialExamError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }

  // The board comes from the catalog, never from the reader layout.
  const prisma = getPrismaClient();
  const examiningBoard = input.boardSlug
    ? await prisma.examiningBoard.findFirst({
        where: { slug: input.boardSlug, isActive: true },
        select: { name: true },
      })
    : null;

  if (!examiningBoard) {
    throw new ConfirmOfficialExamError("Selecione a banca da prova.");
  }

  const metadata = {
    board: analysis.board as OfficialExamReader,
    examiningBoardName: examiningBoard.name,
    organization: parsed.data.organization,
    careerPosition: parsed.data.careerPosition,
    year: parsed.data.year,
    level: parsed.data.level ?? null,
    notice: parsed.data.notice ?? null,
    title: parsed.data.title || `${parsed.data.organization} ${parsed.data.year} – ${parsed.data.careerPosition}`,
  };

  // Choices are re-validated against the current taxonomy.
  const entries = await loadSectionTaxonomyEntries();
  const knowledgeAreas = new Set(
    (await prisma.knowledgeArea.findMany({ where: { isActive: true }, select: { slug: true } })).map((area) => area.slug),
  );

  const sections: Record<string, SectionResolution> = {};

  for (const section of new Set(analysis.questions.map((question) => question.section ?? ""))) {
    const choice = input.sectionChoices?.[section] ?? "auto";

    if (choice.startsWith("discipline:")) {
      const entry = entries.find((candidate) => candidate.disciplineName === choice.slice("discipline:".length));
      sections[section] = entry
        ? { kind: "DISCIPLINE", disciplineName: entry.disciplineName, knowledgeAreaSlug: entry.knowledgeAreaSlug }
        : { kind: "UNRESOLVED" };
    } else if (choice.startsWith("area:") && knowledgeAreas.has(choice.slice("area:".length))) {
      sections[section] = { kind: "KNOWLEDGE_AREA", knowledgeAreaSlug: choice.slice("area:".length) };
    } else {
      sections[section] = resolveExamSection(section || null, entries);
    }
  }

  return runOfficialExamImport({ uploadId: input.uploadId, metadata, sections });
}
