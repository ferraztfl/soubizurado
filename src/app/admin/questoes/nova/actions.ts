"use server";

import { createHash } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  buildCanonicalQuestionFingerprint,
  normalizeQuestionText,
  QUESTION_NORMALIZATION_VERSION,
} from "@/modules/imports/domain/question-fingerprint";
import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { formatQuestionCode } from "@/modules/question-bank/domain/question-code";
import { NEW_QUESTION_LABELS, planNewQuestion, type NewQuestionError } from "@/modules/question-bank/domain/new-question";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

export type CreateQuestionState = Readonly<{
  error: string | null;
}>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One source for every question written in the backoffice. */
const ORIGINAL_SOURCE = {
  reference: "soubizurado-original",
  name: "SouBizurado — questões autorais",
} as const;

const errorMessages: Readonly<Record<NewQuestionError, string>> = {
  STATEMENT_REQUIRED: "Escreva o enunciado.",
  STATEMENT_TOO_LONG: "O enunciado está longo demais.",
  ALTERNATIVE_TOO_LONG: "Uma das alternativas está longa demais.",
  ALTERNATIVES_REQUIRED: "Preencha pelo menos as alternativas A e B.",
  ALTERNATIVE_GAP: "Preencha as alternativas em sequência (sem pular letras).",
  CORRECT_ALTERNATIVE_REQUIRED: "Marque a alternativa correta entre as preenchidas.",
  TRUE_FALSE_ANSWER_REQUIRED: "Escolha o gabarito (Certo ou Errado).",
  DISCIPLINE_REQUIRED: "Escolha a matéria.",
};

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readId(formData: FormData, key: string): string | null {
  const value = readString(formData, key);
  return UUID_PATTERN.test(value) ? value : null;
}

/**
 * Creates an original question in review. Taxonomy comes only from the
 * catalog (ids checked here); publication happens later through the
 * publication policy on the review page.
 */
export async function createQuestionAction(
  _previous: CreateQuestionState,
  formData: FormData,
): Promise<CreateQuestionState> {
  const admin = await requireAdminUser();

  const type = readString(formData, "type") === "TRUE_FALSE" ? "TRUE_FALSE" : "MULTIPLE_CHOICE";
  const trueFalse = readString(formData, "correctTrueFalse");
  const result = planNewQuestion({
    type,
    statement: readString(formData, "statement"),
    alternatives: Object.fromEntries(NEW_QUESTION_LABELS.map((label) => [label, readString(formData, `alternative:${label}`)])),
    correctLabel: readString(formData, "correctLabel") || null,
    correctTrueFalse: trueFalse === "true" ? true : trueFalse === "false" ? false : null,
    disciplineId: readId(formData, "disciplineId"),
  });

  if (!result.ok) {
    return { error: errorMessages[result.error] };
  }

  const { plan } = result;
  const prisma = getPrismaClient();
  const disciplineId = readId(formData, "disciplineId")!;
  const areaId = readId(formData, "areaId");
  const topicId = readId(formData, "topicId");

  const [discipline, area, topic] = await Promise.all([
    prisma.discipline.findFirst({
      where: { id: disciplineId, isActive: true, knowledgeAreaId: { not: null } },
      select: { id: true, knowledgeAreaId: true },
    }),
    areaId ? prisma.area.findFirst({ where: { id: areaId, disciplineId, isActive: true }, select: { id: true } }) : null,
    topicId
      ? prisma.topic.findFirst({ where: { id: topicId, disciplineId, isActive: true }, select: { id: true, areaId: true } })
      : null,
  ]);

  if (!discipline || (areaId && !area) || (topicId && !topic) || (topic && area && topic.areaId !== area.id)) {
    return { error: "Classificação inválida: escolha matéria, tópico e subtópico do catálogo." };
  }

  const canonicalFingerprint = buildCanonicalQuestionFingerprint({
    type: plan.type,
    supportTexts: [],
    statement: plan.statement,
    alternatives: plan.alternatives.map((alternative) => ({ label: alternative.label, content: alternative.content })),
    mediaHashes: [],
  });

  const duplicate = await prisma.question.findUnique({ where: { canonicalFingerprint }, select: { publicNumber: true } });

  if (duplicate) {
    return { error: `Já existe uma questão idêntica: ${formatQuestionCode(duplicate.publicNumber)}.` };
  }

  const created = await prisma.$transaction(async (transaction) => {
    const source = await transaction.questionSource.upsert({
      where: { reference: ORIGINAL_SOURCE.reference },
      update: {},
      create: {
        reference: ORIGINAL_SOURCE.reference,
        name: ORIGINAL_SOURCE.name,
        sourceType: "ORIGINAL",
        licenseStatus: "AUTHORIZED",
        licenseName: "Conteúdo próprio",
      },
      select: { id: true },
    });

    const question = await transaction.question.create({
      data: {
        type: plan.type,
        status: "IN_REVIEW",
        answerKeyStatus: "DEFINED",
        statement: plan.statement,
        correctTrueFalse: plan.correctTrueFalse,
        contentHash: sha256(normalizeQuestionText(plan.statement)),
        canonicalFingerprint,
        normalizationVersion: QUESTION_NORMALIZATION_VERSION,
        sourceId: source.id,
        knowledgeAreaId: discipline.knowledgeAreaId,
        disciplineId: discipline.id,
        areaId: area?.id ?? topic?.areaId ?? null,
        topicId: topic?.id ?? null,
        alternatives: { create: plan.alternatives.map((alternative) => ({ ...alternative })) },
      },
      select: { id: true, publicNumber: true, status: true },
    });

    await transaction.questionRevision.create({
      data: {
        questionId: question.id,
        editorProfileId: admin.profileId,
        reason: "Questão autoral criada no backoffice.",
        changedFields: ["created"],
        answerKeyChanged: false,
        questionStatus: question.status,
        before: {},
        after: {
          statement: plan.statement,
          alternatives: plan.alternatives.map((alternative) => ({ ...alternative })),
          correctTrueFalse: plan.correctTrueFalse,
        },
      },
    });

    return question;
  });

  revalidatePath("/admin/questoes");
  revalidatePath("/admin/questoes/revisao");
  redirect(`/admin/questoes/revisao/${created.id}`);
}
