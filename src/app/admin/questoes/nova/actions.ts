"use server";

import { createHash } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Prisma } from "@/generated/prisma/client";
import {
  buildCanonicalQuestionFingerprint,
  normalizeQuestionText,
  QUESTION_NORMALIZATION_VERSION,
} from "@/modules/imports/domain/question-fingerprint";
import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import {
  MAX_STATEMENT_IMAGES,
  NEW_QUESTION_LABELS,
  placeStatementImages,
  planNewQuestion,
  type NewQuestionError,
  type NewQuestionPlan,
} from "@/modules/question-bank/domain/new-question";
import { formatQuestionCode } from "@/modules/question-bank/domain/question-code";
import {
  InvalidImageError,
  isFilledFile,
  prepareUploadedImage,
  uploadPreparedImage,
  type PreparedImage,
} from "@/modules/question-bank/infrastructure/uploaded-question-image";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

export type CreateQuestionState = Readonly<{
  error: string | null;
}>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sources of questions entered in the backoffice (one per kind). */
const SOURCES = {
  ORIGINAL: {
    reference: "soubizurado-original",
    name: "SouBizurado — questões autorais",
    sourceType: "ORIGINAL",
    licenseStatus: "AUTHORIZED",
    licenseName: "Conteúdo próprio",
  },
  EXAM: {
    reference: "soubizurado-manual-exam",
    name: "Inserção manual — provas de concursos",
    sourceType: "OFFICIAL_EXAM",
    licenseStatus: "PUBLIC_DOMAIN",
    licenseName: "Prova de concurso público",
  },
} as const;

const errorMessages: Readonly<Record<NewQuestionError, string>> = {
  STATEMENT_REQUIRED: "Escreva o enunciado.",
  STATEMENT_TOO_LONG: "O enunciado está longo demais.",
  SUPPORT_TEXT_TOO_LONG: "O texto de apoio está longo demais.",
  ALTERNATIVE_TOO_LONG: "Uma das alternativas está longa demais.",
  ALTERNATIVES_REQUIRED: "Preencha pelo menos as alternativas A e B (texto ou imagem).",
  ALTERNATIVE_GAP: "Preencha as alternativas em sequência (sem pular letras).",
  CORRECT_ALTERNATIVE_REQUIRED: "Marque a alternativa correta entre as preenchidas.",
  TRUE_FALSE_ANSWER_REQUIRED: "Escolha o gabarito (Certo ou Errado).",
  DISCIPLINE_REQUIRED: "Escolha a matéria.",
  TOO_MANY_IMAGES: `Envie no máximo ${MAX_STATEMENT_IMAGES} imagens no enunciado.`,
  IMAGE_TOKEN_UNKNOWN: "O enunciado cita uma [imagem N] que não foi enviada.",
  EXAM_BOARD_REQUIRED: "Escolha a banca.",
  EXAM_YEAR_INVALID: "Informe o ano da prova (de 1990 até o ano atual).",
  EXAM_ORGANIZATION_REQUIRED: "Informe o órgão do concurso.",
  EXAM_POSITION_REQUIRED: "Informe o cargo.",
  EXAM_NAME_TOO_LONG: "Órgão, cargo ou número da questão longo demais.",
};

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** Same scheme as the importers, so a typed organization meets the imported one. */
function slugify(value: string, maxLength: number): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLocaleLowerCase("pt-BR")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, maxLength) || sha256(value).slice(0, 24)
  );
}

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readId(formData: FormData, key: string): string | null {
  const value = readString(formData, key);
  return UUID_PATTERN.test(value) ? value : null;
}

type Upload = PreparedImage & Readonly<{ storageKey: string; provider: string; bucket: string }>;

async function resolveExamination(
  transaction: Prisma.TransactionClient,
  exam: NonNullable<NewQuestionPlan["exam"]>,
): Promise<string> {
  const organization = await transaction.publicOrganization.upsert({
    where: { slug: slugify(exam.organization, 220) },
    update: {},
    create: { name: exam.organization, slug: slugify(exam.organization, 220) },
    select: { id: true },
  });
  const careerPosition = await transaction.careerPosition.upsert({
    where: { slug: slugify(exam.careerPosition, 200) },
    update: {},
    create: { name: exam.careerPosition, slug: slugify(exam.careerPosition, 200) },
    select: { id: true },
  });

  // The same exam imported earlier (any source) is reused.
  const existing = await transaction.examination.findFirst({
    where: { boardId: exam.boardId, year: exam.year, organizationId: organization.id, careerPositionId: careerPosition.id },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (existing) return existing.id;

  const title = `${exam.organization} - ${exam.careerPosition} - ${exam.year}`.slice(0, 240);
  const created = await transaction.examination.upsert({
    where: { slug: `manual-${slugify(`${title}-${exam.boardId.slice(0, 8)}`, 250)}` },
    update: {},
    create: {
      title,
      slug: `manual-${slugify(`${title}-${exam.boardId.slice(0, 8)}`, 250)}`,
      year: exam.year,
      boardId: exam.boardId,
      organizationId: organization.id,
      careerPositionId: careerPosition.id,
    },
    select: { id: true },
  });

  return created.id;
}

async function linkAsset(transaction: Prisma.TransactionClient, upload: Upload, altText: string): Promise<string> {
  const asset = await transaction.mediaAsset.upsert({
    where: { checksum: upload.checksum },
    update: {},
    create: {
      checksum: upload.checksum,
      storageProvider: upload.provider,
      bucket: upload.bucket,
      storageKey: upload.storageKey,
      mimeType: upload.mimeType,
      sizeBytes: BigInt(upload.bytes.byteLength),
      width: upload.width,
      height: upload.height,
      altText,
      sourceUrl: "admin-upload",
    },
    select: { id: true },
  });

  return asset.id;
}

/**
 * Creates a question in review: original, or from an exam the reviewer
 * chose (catalog board + year + organization + position). Taxonomy only
 * from the catalog; images re-encoded server-side into the private
 * bucket. Publication happens later through the publication policy.
 */
export async function createQuestionAction(
  _previous: CreateQuestionState,
  formData: FormData,
): Promise<CreateQuestionState> {
  const admin = await requireAdminUser();

  const kind = readString(formData, "kind") === "EXAM" ? "EXAM" : "ORIGINAL";
  const type = readString(formData, "type") === "TRUE_FALSE" ? "TRUE_FALSE" : "MULTIPLE_CHOICE";
  const trueFalse = readString(formData, "correctTrueFalse");
  const statementFiles = formData.getAll("statementImages").filter(isFilledFile);
  const alternativeFiles = new Map<string, File>(
    type === "MULTIPLE_CHOICE"
      ? NEW_QUESTION_LABELS.flatMap((label) => {
          const file = formData.get(`alternativeImage:${label}`);
          return isFilledFile(file) ? [[label, file] as const] : [];
        })
      : [],
  );

  const result = planNewQuestion({
    kind,
    type,
    statement: readString(formData, "statement"),
    supportText: readString(formData, "supportText"),
    alternatives: Object.fromEntries(NEW_QUESTION_LABELS.map((label) => [label, readString(formData, `alternative:${label}`)])),
    alternativesWithImage: new Set(alternativeFiles.keys()),
    statementImageCount: statementFiles.length,
    correctLabel: readString(formData, "correctLabel") || null,
    correctTrueFalse: trueFalse === "true" ? true : trueFalse === "false" ? false : null,
    disciplineId: readId(formData, "disciplineId"),
    exam: {
      boardId: readId(formData, "boardId"),
      year: Number(readString(formData, "year")) || null,
      organization: readString(formData, "organization"),
      careerPosition: readString(formData, "careerPosition"),
      questionNumber: readString(formData, "questionNumber"),
    },
    currentYear: new Date().getFullYear(),
  });

  if (!result.ok) {
    return { error: errorMessages[result.error] };
  }

  const { plan } = result;
  const prisma = getPrismaClient();
  const disciplineId = readId(formData, "disciplineId")!;
  const areaId = readId(formData, "areaId");
  const topicId = readId(formData, "topicId");

  const [discipline, area, topic, board] = await Promise.all([
    prisma.discipline.findFirst({
      where: { id: disciplineId, isActive: true, knowledgeAreaId: { not: null } },
      select: { id: true, knowledgeAreaId: true },
    }),
    areaId ? prisma.area.findFirst({ where: { id: areaId, disciplineId, isActive: true }, select: { id: true } }) : null,
    topicId
      ? prisma.topic.findFirst({ where: { id: topicId, disciplineId, isActive: true }, select: { id: true, areaId: true } })
      : null,
    plan.exam ? prisma.examiningBoard.findFirst({ where: { id: plan.exam.boardId, isActive: true }, select: { id: true } }) : null,
  ]);

  if (!discipline || (areaId && !area) || (topicId && !topic) || (topic && area && topic.areaId !== area.id)) {
    return { error: "Classificação inválida: escolha matéria, tópico e subtópico do catálogo." };
  }

  if (plan.exam && !board) {
    return { error: "Banca inválida: escolha uma banca do catálogo." };
  }

  let statementImages: PreparedImage[];
  let alternativeImages: Map<string, PreparedImage>;

  try {
    statementImages = await Promise.all(statementFiles.map(prepareUploadedImage));
    alternativeImages = new Map(
      await Promise.all(
        plan.alternatives
          .filter((alternative) => alternativeFiles.has(alternative.label))
          .map(async (alternative) => [alternative.label, await prepareUploadedImage(alternativeFiles.get(alternative.label)!)] as const),
      ),
    );
  } catch (error) {
    if (error instanceof InvalidImageError) return { error: error.message };
    throw error;
  }

  const canonicalFingerprint = buildCanonicalQuestionFingerprint({
    type: plan.type,
    supportTexts: plan.supportText ? [plan.supportText] : [],
    statement: plan.statement,
    alternatives: plan.alternatives.map((alternative) => ({ label: alternative.label, content: alternative.content })),
    mediaHashes: [
      ...statementImages.map((image) => `statement:${image.checksum}`),
      ...[...alternativeImages].map(([label, image]) => `alternative:${label}:${image.checksum}`),
    ],
  });

  const duplicate = await prisma.question.findUnique({ where: { canonicalFingerprint }, select: { publicNumber: true } });

  if (duplicate) {
    return { error: `Já existe uma questão idêntica: ${formatQuestionCode(duplicate.publicNumber)}.` };
  }

  // Uploads happen before the transaction (content-addressed: a retry
  // reuses the same objects); only database rows are transactional.
  let statementUploads: Upload[];
  let alternativeUploads: Map<string, Upload>;

  try {
    statementUploads = await Promise.all(statementImages.map(async (image) => ({ ...image, ...(await uploadPreparedImage(image)) })));
    alternativeUploads = new Map(
      await Promise.all(
        [...alternativeImages].map(async ([label, image]) => [label, { ...image, ...(await uploadPreparedImage(image)) }] as const),
      ),
    );
  } catch {
    return { error: "Não foi possível enviar as imagens para o armazenamento. Tente de novo." };
  }

  const created = await prisma.$transaction(async (transaction) => {
    const sourceConfig = SOURCES[kind];
    const source = await transaction.questionSource.upsert({
      where: { reference: sourceConfig.reference },
      update: {},
      create: { ...sourceConfig },
      select: { id: true },
    });

    const examinationId = plan.exam ? await resolveExamination(transaction, plan.exam) : null;

    const statementAssetIds: string[] = [];
    for (const [index, upload] of statementUploads.entries()) {
      statementAssetIds.push(await linkAsset(transaction, upload, `Imagem ${index + 1} do enunciado`));
    }

    const statement = placeStatementImages(plan.statement, statementAssetIds);

    const question = await transaction.question.create({
      data: {
        type: plan.type,
        status: "IN_REVIEW",
        answerKeyStatus: "DEFINED",
        statement,
        correctTrueFalse: plan.correctTrueFalse,
        contentHash: sha256(normalizeQuestionText(plan.statement)),
        canonicalFingerprint,
        normalizationVersion: QUESTION_NORMALIZATION_VERSION,
        sourceId: source.id,
        examinationId,
        knowledgeAreaId: discipline.knowledgeAreaId,
        disciplineId: discipline.id,
        areaId: area?.id ?? topic?.areaId ?? null,
        topicId: topic?.id ?? null,
      },
      select: { id: true, publicNumber: true, status: true },
    });

    for (const [position, assetId] of statementAssetIds.entries()) {
      await transaction.questionMediaLink.create({
        data: { questionId: question.id, mediaAssetId: assetId, role: "QUESTION_ATTACHMENT", position },
      });
    }

    for (const alternative of plan.alternatives) {
      const row = await transaction.questionAlternative.create({
        data: { ...alternative, questionId: question.id },
        select: { id: true },
      });
      const upload = alternativeUploads.get(alternative.label);

      if (upload) {
        const assetId = await linkAsset(transaction, upload, `Imagem da alternativa ${alternative.label}`);
        await transaction.questionAlternativeMediaLink.create({
          data: { alternativeId: row.id, mediaAssetId: assetId, position: 0 },
        });
      }
    }

    if (plan.supportText) {
      const contentHash = sha256(normalizeQuestionText(plan.supportText));
      const support = await transaction.questionSupportContent.upsert({
        where: { contentHash },
        update: {},
        create: { content: plan.supportText, contentHash },
        select: { id: true },
      });
      await transaction.questionSupportLink.create({
        data: { questionId: question.id, supportContentId: support.id, position: 0 },
      });
    }

    if (examinationId) {
      await transaction.questionOccurrence.create({
        data: {
          questionId: question.id,
          sourceId: source.id,
          examinationId,
          externalId: `manual-${question.id}`,
          externalQuestionNumber: plan.exam?.questionNumber ?? null,
        },
      });
    }

    await transaction.questionRevision.create({
      data: {
        questionId: question.id,
        editorProfileId: admin.profileId,
        reason: kind === "EXAM" ? "Questão de prova inserida manualmente no backoffice." : "Questão autoral criada no backoffice.",
        changedFields: ["created"],
        answerKeyChanged: false,
        questionStatus: question.status,
        before: {},
        after: {
          statement,
          supportText: plan.supportText,
          alternatives: plan.alternatives.map((alternative) => ({ ...alternative })),
          correctTrueFalse: plan.correctTrueFalse,
          exam: plan.exam,
          images: { statement: statementAssetIds.length, alternatives: [...alternativeUploads.keys()] },
        },
      },
    });

    return question;
  });

  revalidatePath("/admin/questoes");
  revalidatePath("/admin/questoes/revisao");
  redirect(`/admin/questoes/revisao/${created.id}`);
}
