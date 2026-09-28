import { NextResponse } from "next/server";

import { PHASE_LABELS, progressPercent, remainingSeconds } from "@/modules/contests/domain/import-progress";
import { findNoticeImportJob } from "@/modules/contests/infrastructure/notice-import-jobs";
import { requireAdminUser } from "@/modules/identity/application/require-admin-user";

import type { NoticeImportResult, NoticeImportStatus } from "../../../../admin/concursos/importar/import-types";

export const dynamic = "force-dynamic";

type RouteContext = Readonly<{ params: Promise<Readonly<{ jobId: string }>> }>;

/** Progress of a notice import (only for the admin who started it). */
export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const admin = await requireAdminUser();
  const { jobId } = await context.params;
  const job = findNoticeImportJob<NoticeImportResult>(jobId, admin.profileId);

  if (!job) {
    return NextResponse.json({ error: "Leitura não encontrada (ela expira depois de 1 hora)." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const now = Date.now();
  const status: NoticeImportStatus = {
    phase: job.phase,
    label: PHASE_LABELS[job.phase],
    percent: progressPercent(job, now),
    elapsedSeconds: Math.round(((job.finishedAt ?? now) - job.startedAt) / 1000),
    remainingSeconds: remainingSeconds(job, now),
    provider: job.provider,
    result: job.result,
    error: job.error,
  };

  return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
}
