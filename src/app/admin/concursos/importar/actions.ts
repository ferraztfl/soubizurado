"use server";

import { redirect } from "next/navigation";

import { planPost } from "@/modules/blog/domain/blog";
import { buildContestSummary, buildNewsDraft } from "@/modules/contests/domain/notice-drafts";
import { matchBoard, toNoticeSuggestion } from "@/modules/contests/domain/notice-extraction";
import {
  extractNoticeFacts,
  extractNoticeFactsLocal,
  isNoticeAiConfigured,
  NoticeReadError,
  readNoticePdf,
} from "@/modules/contests/infrastructure/notice-reader";
import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { isFilledFile } from "@/modules/question-bank/infrastructure/uploaded-question-image";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import type { ContestFormValues } from "../contest-form";
import { contestFormValues, EMPTY_CONTEST_FORM_VALUES } from "../contest-form-values";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type NoticeImportState =
  | Readonly<{ status: "idle" }>
  | Readonly<{ status: "error"; message: string }>
  | Readonly<{
      status: "ok";
      /** Changes every import, so the prefilled form remounts. */
      key: string;
      values: ContestFormValues;
      news: Readonly<{ title: string; excerpt: string; body: string }> | null;
      warnings: readonly string[];
      usage: Readonly<{ inputTokens: number; outputTokens: number; provider: "local" | "remote"; seconds: number }>;
    }>;

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function httpsUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString().slice(0, 500) : null;
  } catch {
    return null;
  }
}

/**
 * Reads an official notice (PDF) with the AI and returns suggestions for the
 * contest form. Nothing is saved here: the admin reviews and saves.
 */
export async function importNoticeAction(_previous: NoticeImportState, formData: FormData): Promise<NoticeImportState> {
  await requireAdminUser();

  const provider = readString(formData, "ai") === "remote" ? "remote" : "local";
  if (provider === "remote" && !isNoticeAiConfigured()) {
    return { status: "error", message: "A IA online não está configurada no .env (CLASSIFIER_API_BASE_URL e CLASSIFIER_MODEL)." };
  }

  const file = formData.get("pdf");
  if (!isFilledFile(file)) return { status: "error", message: "Envie o PDF do edital." };

  const noticeUrl = readString(formData, "noticeUrl").trim();
  const officialUrl = noticeUrl ? httpsUrl(noticeUrl) : null;
  if (noticeUrl && !officialUrl) return { status: "error", message: "O link do edital precisa começar com https://." };

  const prisma = getPrismaClient();
  const existingId = readString(formData, "contestId");
  const existing = UUID.test(existingId)
    ? await prisma.contest.findUnique({ where: { id: existingId }, include: { contestPositions: true } })
    : null;

  try {
    const started = Date.now();
    const text = await readNoticePdf(file);
    const { extraction, inputTokens, outputTokens } =
      provider === "remote" ? await extractNoticeFacts(text, officialUrl) : await extractNoticeFactsLocal(text, officialUrl);
    const extracted = toNoticeSuggestion(extraction);
    // The local model only extracts facts: summary and news come from our template.
    const suggestion = {
      ...extracted,
      summary: extracted.summary || buildContestSummary(extracted),
      news: extracted.news ?? buildNewsDraft(extracted),
      warnings: extracted.warnings.filter((warning) => !warning.includes("rascunho da notícia")),
    };

    const boards = await prisma.examiningBoard.findMany({ where: { isActive: true }, select: { id: true, name: true } });
    const board = matchBoard(boards, suggestion.boardName);
    const warnings = [...suggestion.warnings];
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
      noticeUrl: officialUrl ?? base.noticeUrl,
      boardId: board?.id ?? base.boardId,
      positionLines: pick(suggestion.positionLines, base.positionLines),
      feeText: pick(suggestion.feeText, base.feeText),
      stages: pick(suggestion.stages, base.stages),
      examLocations: pick(suggestion.examLocations, base.examLocations),
    };

    return {
      status: "ok",
      key: `${Date.now()}`,
      values,
      news: suggestion.news,
      warnings,
      usage: { inputTokens, outputTokens, provider, seconds: Math.round((Date.now() - started) / 1000) },
    };
  } catch (error) {
    if (error instanceof NoticeReadError) return { status: "error", message: error.message };
    throw error;
  }
}

/** Saves the AI news draft as a blog DRAFT (never published from here) and opens it in the editor. */
export async function createNewsDraftAction(formData: FormData): Promise<void> {
  const admin = await requireAdminUser();

  const result = planPost(
    {
      title: readString(formData, "title"),
      slug: "",
      excerpt: readString(formData, "excerpt"),
      body: readString(formData, "body"),
      status: "DRAFT",
      publishAt: "",
      categoryName: "Editais",
      format: "NEWS",
      stateCode: readString(formData, "stateCode"),
      isFeatured: false,
    },
    new Date(),
  );

  if (!result.ok) redirect(`/admin/concursos/importar?erro=${encodeURIComponent("Rascunho inválido: confira título e texto.")}`);

  const prisma = getPrismaClient();
  const { post } = result;
  const slugTaken = await prisma.blogPost.findUnique({ where: { slug: post.slug }, select: { id: true } });
  const category = await prisma.blogCategory.findUnique({ where: { slug: "editais" }, select: { id: true } });
  const contestId = readString(formData, "contestId");
  const contest = UUID.test(contestId) ? await prisma.contest.findUnique({ where: { id: contestId }, select: { id: true } }) : null;

  const created = await prisma.blogPost.create({
    data: {
      title: post.title,
      slug: slugTaken ? `${post.slug.slice(0, 150)}-${Date.now().toString(36)}` : post.slug,
      excerpt: post.excerpt,
      body: post.body,
      status: "DRAFT",
      publishedAt: null,
      categoryId: category?.id ?? null,
      format: "NEWS",
      stateCode: post.stateCode,
      authorProfileId: admin.profileId,
      contestId: contest?.id ?? null,
    },
    select: { id: true },
  });

  redirect(`/admin/blog/${created.id}?ok=1`);
}
