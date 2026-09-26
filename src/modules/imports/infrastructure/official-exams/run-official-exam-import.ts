import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
} from "node:fs/promises";
import {
  dirname,
  extname,
  join,
  resolve,
} from "node:path";

import { createQuestionClassifier } from "@/modules/classification/infrastructure/create-question-classifier";
import { PrismaClassificationTaskRepository } from "@/modules/classification/infrastructure/prisma-classification-task-repository";
import { normalizeTaxonomyTerm } from "@/modules/taxonomy/domain/taxonomy-term";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import {
  examSlug,
  OFFICIAL_EXAM_BOARDS,
  type OfficialExamMetadata,
} from "../../application/official-exams/official-exam";
import type {
  SectionResolution,
  SectionTaxonomyEntry,
} from "../../application/official-exams/resolve-exam-section";
import { processMediaQueue } from "../../application/services/process-media-queue";
import { ImportProviderQuestionsUseCase } from "../../application/use-cases/import-provider-questions";
import { HttpMediaSourceReader } from "../media/http-media-source-reader";
import { LocalMediaStorage } from "../media/local-media-storage";
import { RoutingMediaSourceReader } from "../media/routing-media-source-reader";
import { StagedMediaSourceReader } from "../media/staged-media-source-reader";
import { PrismaMediaTaskRepository } from "../repositories/prisma-media-task-repository";
import { createConfiguredQuestionImportRepository } from "../repositories/prisma-question-import-repository";

import {
  importableQuestions,
  OfficialExamProvider,
} from "./official-exam-provider";
import {
  loadAnalysis,
  type OfficialExamImportResult,
  saveResult,
  workspaceFile,
} from "./official-exam-upload-store";

const PAGE_SIZE = 100;

export async function loadSectionTaxonomyEntries(): Promise<SectionTaxonomyEntry[]> {
  const disciplines = await getPrismaClient().discipline.findMany({
    where: { isActive: true, knowledgeAreaId: { not: null } },
    select: {
      name: true,
      knowledgeArea: { select: { slug: true } },
      aliases: { select: { name: true } },
    },
  });

  return disciplines
    .filter((discipline) => discipline.knowledgeArea)
    .map((discipline) => ({
      disciplineName: discipline.name,
      knowledgeAreaSlug: discipline.knowledgeArea!.slug,
      terms: [discipline.name, ...discipline.aliases.map((alias) => alias.name)].map(
        normalizeTaxonomyTerm,
      ),
    }));
}

function stagingRoot(): string {
  return resolve(process.env.MEDIA_STAGING_LOCAL_ROOT ?? "data-private/media-staging");
}

async function stageImages(
  uploadId: string,
  checksum: string,
  names: readonly string[],
): Promise<Record<string, string>> {
  const staged: Record<string, string> = {};

  for (const name of new Set(names)) {
    const source = workspaceFile(uploadId, name);

    if (!source) {
      throw new Error(`Invalid extracted image name: ${name}.`);
    }

    const bytes = await readFile(source);
    const digest = createHash("sha256").update(bytes).digest("hex");
    const relativeKey = [
      "official-exams",
      checksum.slice(0, 16),
      `${digest}${extname(name).toLowerCase()}`,
    ].join("/");
    const target = join(stagingRoot(), ...relativeKey.split("/"));

    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
    staged[name] = `staging://local/${relativeKey}`;
  }

  return staged;
}

async function processStagedMedia(limit: number): Promise<{ completed: number; failed: number }> {
  if (limit === 0) {
    return { completed: 0, failed: 0 };
  }

  const maxBytes = Number(process.env.MEDIA_MAX_BYTES ?? 25 * 1024 * 1024);
  const result = await processMediaQueue({
    repository: new PrismaMediaTaskRepository(),
    reader: new RoutingMediaSourceReader({
      httpReader: new HttpMediaSourceReader({ maxBytes }),
      stagedReader: new StagedMediaSourceReader({ rootDirectory: stagingRoot(), maxBytes }),
    }),
    storage: new LocalMediaStorage({
      rootDirectory: resolve(process.env.MEDIA_STORAGE_LOCAL_ROOT ?? "data-private/media-store"),
      bucket: process.env.MEDIA_STORAGE_BUCKET ?? "question-media",
    }),
    concurrency: 4,
    limit: Math.min(limit, 10_000),
    maxAttempts: 5,
    staleMinutes: 15,
  });

  return { completed: result.completed, failed: result.failed };
}

async function enqueueClassification(jobIds: readonly string[]): Promise<number> {
  const prisma = getPrismaClient();
  const questions = await prisma.question.findMany({
    where: {
      status: "IN_REVIEW",
      topicId: null,
      importItems: { some: { jobId: { in: [...jobIds] } } },
    },
    select: { id: true },
  });

  if (questions.length === 0) {
    return 0;
  }

  const classifier = createQuestionClassifier();
  const repository = new PrismaClassificationTaskRepository(prisma);
  const taxonomy = await repository.loadTaxonomyIndex();

  return repository.enqueue({
    questionIds: questions.map((question) => question.id),
    provider: classifier.provider,
    model: classifier.model,
    classifierVersion: classifier.version,
    taxonomyVersion: taxonomy.version,
  });
}

/**
 * Imports an analyzed booklet: stages images, runs the standard import
 * pipeline (questions land IN_REVIEW, never published), stores the
 * images through the media queue and enqueues classification.
 */
export async function runOfficialExamImport(
  input: Readonly<{
    uploadId: string;
    metadata: OfficialExamMetadata;
    sections: Readonly<Record<string, SectionResolution>>;
  }>,
): Promise<OfficialExamImportResult> {
  const analysis = await loadAnalysis(input.uploadId);

  if (!analysis) {
    throw new Error("Análise não encontrada para este envio.");
  }

  if (analysis.blockingIssues.length > 0) {
    throw new Error("A análise tem pendências que impedem a importação.");
  }

  const unresolved = [...new Set(analysis.questions.map((question) => question.section ?? ""))].filter(
    (section) => (input.sections[section]?.kind ?? "UNRESOLVED") === "UNRESOLVED",
  );

  if (unresolved.length > 0) {
    throw new Error(`Defina a disciplina ou área das seções: ${unresolved.join(", ") || "(sem seção)"}.`);
  }

  const questions = importableQuestions(analysis);
  const imageNames = questions.flatMap((question) => [
    ...question.images,
    ...question.supportImages,
    ...question.alternatives.flatMap((alternative) => alternative.images),
  ]);

  const examinationSlug = examSlug(input.metadata, analysis.bookletChecksum);
  const stagedMedia = await stageImages(input.uploadId, analysis.bookletChecksum, imageNames);

  const provider = new OfficialExamProvider({
    analysis,
    metadata: input.metadata,
    examinationSlug,
    sections: input.sections,
    stagedMedia,
  });

  const repository = createConfiguredQuestionImportRepository({
    providerCode: `OFFICIAL_EXAM_${input.metadata.board}`,
    reference: `official-exam-${examinationSlug}`.slice(0, 250),
    name: `${OFFICIAL_EXAM_BOARDS[input.metadata.board]} – ${input.metadata.title}`.slice(0, 200),
    url: null,
    sourceType: "OFFICIAL_EXAM",
    licenseStatus: "UNKNOWN",
    licenseName: null,
    licenseNotes: `Prova oficial publicada pela banca (${OFFICIAL_EXAM_BOARDS[input.metadata.board]}), enviada pelo administrador. Arquivo: ${analysis.bookletFileName} (sha256 ${analysis.bookletChecksum}).`,
  });

  const useCase = new ImportProviderQuestionsUseCase(provider, repository);
  const counts = { received: 0, imported: 0, duplicates: 0, reviewRequired: 0, failed: 0 };
  const jobIds: string[] = [];
  let afterId: string | undefined;

  do {
    const page = await useCase.execute({
      limit: PAGE_SIZE,
      examinationId: examinationSlug,
      afterId,
      publish: false,
    });

    jobIds.push(page.jobId);
    counts.received += page.received;
    counts.imported += page.imported;
    counts.duplicates += page.duplicates;
    counts.reviewRequired += page.reviewRequired;
    counts.failed += page.failed;

    if (!page.nextCursor || page.nextCursor === afterId) {
      break;
    }

    afterId = page.nextCursor;
  } while (true);

  const mediaTasks = await processStagedMedia(imageNames.length);
  const classificationEnqueued = await enqueueClassification(jobIds);

  const result: OfficialExamImportResult = {
    finishedAt: new Date().toISOString(),
    examinationSlug,
    jobIds,
    counts,
    skippedAnnulled: analysis.questions.filter((question) => question.annulled).length,
    mediaTasks,
    classificationEnqueued,
  };

  await saveResult(input.uploadId, result);

  return result;
}
