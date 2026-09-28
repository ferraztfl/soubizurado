"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";

import { planPost } from "@/modules/blog/domain/blog";
import { createNoticeImportJob } from "@/modules/contests/infrastructure/notice-import-jobs";
import { isNoticeAiConfigured, localAiSpeeds, MAX_NOTICE_BYTES } from "@/modules/contests/infrastructure/notice-reader";
import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { isFilledFile } from "@/modules/question-bank/infrastructure/uploaded-question-image";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import type { NoticeImportResult } from "./import-types";
import { initialReadingEstimateMs, runNoticeImport } from "./run-notice-import";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type StartNoticeImportResult = Readonly<{ ok: true; jobId: string }> | Readonly<{ ok: false; message: string }>;

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
 * Starts reading an official notice (PDF) with the AI. Answers right away with
 * a job id; the screen follows the progress. Nothing is saved: the admin
 * reviews the suggestions and saves through the normal form.
 */
export async function startNoticeImportAction(formData: FormData): Promise<StartNoticeImportResult> {
  const admin = await requireAdminUser();

  const provider = readString(formData, "ai") === "remote" ? "remote" : "local";
  if (provider === "remote" && !isNoticeAiConfigured()) {
    return { ok: false, message: "A IA online não está configurada no .env (CLASSIFIER_API_BASE_URL e CLASSIFIER_MODEL)." };
  }

  const file = formData.get("pdf");
  if (!isFilledFile(file)) return { ok: false, message: "Envie o PDF do edital." };
  if (file.size > MAX_NOTICE_BYTES) return { ok: false, message: "O PDF passa de 30 MB." };

  const noticeUrl = readString(formData, "noticeUrl").trim();
  const officialUrl = noticeUrl ? httpsUrl(noticeUrl) : null;
  if (noticeUrl && !officialUrl) return { ok: false, message: "O link do edital precisa começar com https://." };

  const existingId = readString(formData, "contestId");
  const job = createNoticeImportJob<NoticeImportResult>(admin.profileId, provider, localAiSpeeds().writing);
  if (!job) return { ok: false, message: "Já há leituras em andamento. Espere uma terminar." };

  // The uploaded file belongs to this request: keep a copy for the background work.
  const copy = new File([new Uint8Array(await file.arrayBuffer())], "edital.pdf", { type: "application/pdf" });
  job.expectedReadingMs = provider === "remote" ? 25_000 : initialReadingEstimateMs(copy.size);

  after(() =>
    runNoticeImport(job, {
      file: copy,
      officialUrl,
      existingContestId: UUID.test(existingId) ? existingId : null,
    }),
  );

  return { ok: true, jobId: job.id };
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
