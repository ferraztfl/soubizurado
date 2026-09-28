import { randomUUID } from "node:crypto";

import type { ImportPhase } from "../domain/import-progress";

/** "none" = rules only (seconds); "local" = + Ollama; "remote" = + online AI. */
export type NoticeAiProvider = "none" | "local" | "remote";

/*
 * In-memory registry of notice imports in progress (one server process —
 * the local AI runs on this same machine). Each job belongs to the admin
 * who started it; finished jobs are dropped after an hour.
 */

export type NoticeImportJob<Result> = {
  id: string;
  ownerProfileId: string;
  startedAt: number;
  phase: ImportPhase;
  phaseStartedAt: number;
  expectedReadingMs: number;
  generatedTokens: number;
  writingTokensPerSecond: number;
  provider: NoticeAiProvider;
  result: Result | null;
  error: string | null;
  finishedAt: number | null;
};

const MAX_AGE_MS = 60 * 60_000;
const MAX_RUNNING_PER_OWNER = 2;

const store = globalThis as unknown as { __sbNoticeJobs?: Map<string, NoticeImportJob<unknown>> };
store.__sbNoticeJobs ??= new Map();
const jobs = store.__sbNoticeJobs;

function prune(now: number): void {
  for (const [id, job] of jobs) {
    if (now - job.startedAt > MAX_AGE_MS) jobs.delete(id);
  }
}

export function createNoticeImportJob<Result>(
  ownerProfileId: string,
  provider: NoticeAiProvider,
  writingTokensPerSecond: number,
): NoticeImportJob<Result> | null {
  const now = Date.now();
  prune(now);
  const running = [...jobs.values()].filter((job) => job.ownerProfileId === ownerProfileId && job.finishedAt === null).length;
  if (running >= MAX_RUNNING_PER_OWNER) return null;

  const job: NoticeImportJob<Result> = {
    id: randomUUID(),
    ownerProfileId,
    startedAt: now,
    phase: "received",
    phaseStartedAt: now,
    expectedReadingMs: 0,
    generatedTokens: 0,
    writingTokensPerSecond,
    provider,
    result: null,
    error: null,
    finishedAt: null,
  };
  jobs.set(job.id, job as NoticeImportJob<unknown>);
  return job;
}

/** The job, only for the admin who started it. */
export function findNoticeImportJob<Result>(id: string, ownerProfileId: string): NoticeImportJob<Result> | null {
  const job = jobs.get(id);
  return job && job.ownerProfileId === ownerProfileId ? (job as NoticeImportJob<Result>) : null;
}

export function setJobPhase(job: NoticeImportJob<unknown>, phase: ImportPhase, changes: Partial<NoticeImportJob<unknown>> = {}): void {
  Object.assign(job, changes);
  if (job.phase !== phase) {
    job.phase = phase;
    job.phaseStartedAt = Date.now();
  }
}
