import { createHash } from "node:crypto";

import {
  buildCanonicalQuestionFingerprint,
  normalizeQuestionText,
  QUESTION_NORMALIZATION_VERSION,
  questionHtmlToPlainText,
} from "../../domain/question-fingerprint";
import type {
  ProviderExaminationMetadata,
  ProviderQuestionCandidate,
  QuestionProvider,
  QuestionProviderListInput,
} from "../ports/question-provider";
import type {
  PersistImportedQuestionInput,
  QuestionImportRepository,
} from "../ports/question-import-repository";

export type ImportProviderQuestionsInput =
  Readonly<{
    limit: number;
    externalId?: string;
    examinationId?: string;
    afterId?: string;
    publish?: boolean;
    filters?: QuestionProviderListInput["filters"];
  }>;

export type ImportProviderQuestionsOutput =
  Readonly<{
    jobId: string;
    received: number;
    imported: number;
    duplicates: number;
    reviewRequired: number;
    failed: number;
    nextCursor: string | null;
  }>;

function sha256(
  value: string,
): string {
  return createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

function payloadHash(
  value: unknown,
): string {
  const serialized = JSON.stringify(value);

  if (serialized === undefined) {
    return sha256("null");
  }

  return sha256(serialized);
}

function determineQuestionType(
  candidate: ProviderQuestionCandidate,
  examination:
    | ProviderExaminationMetadata
    | null,
): "MULTIPLE_CHOICE" | "TRUE_FALSE" {
  if (
    examination?.alternativeType ===
    "CERTO_ERRADO"
  ) {
    return "TRUE_FALSE";
  }

  if (
    examination?.alternativeType ===
    "MULTIPLA_ESCOLHA"
  ) {
    return "MULTIPLE_CHOICE";
  }

  const labels = candidate.alternatives
    .map((alternative) =>
      alternative.label
        .trim()
        .toLocaleUpperCase("pt-BR"),
    )
    .sort();

  if (
    labels.length === 2 &&
    labels[0] === "C" &&
    labels[1] === "E"
  ) {
    return "TRUE_FALSE";
  }

  return "MULTIPLE_CHOICE";
}

function parseTrueFalseAnswer(
  answerKey: string,
): boolean | null {
  const normalized = answerKey
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR");

  if (
    normalized === "C" ||
    normalized === "CERTO" ||
    normalized === "V" ||
    normalized === "VERDADEIRO"
  ) {
    return true;
  }

  if (
    normalized === "E" ||
    normalized === "ERRADO" ||
    normalized === "F" ||
    normalized === "FALSO"
  ) {
    return false;
  }

  return null;
}

function normalizeAlternativeLabel(
  value: string,
): string {
  return value
    .trim()
    .toLocaleUpperCase("pt-BR");
}

function buildPersistenceInput(
  input: Readonly<{
    jobId: string;
    sourceId: string;
    candidate: ProviderQuestionCandidate;
    examination:
      | ProviderExaminationMetadata
      | null;
    publish: boolean;
  }>,
): PersistImportedQuestionInput | null {
  const {
    candidate,
    examination,
  } = input;

  if (
    !candidate.answerKey ||
    !candidate.discipline ||
    (input.publish && !candidate.topic)
  ) {
    return null;
  }

  const statement =
    questionHtmlToPlainText(
      candidate.statementHtml,
    );

  if (!statement) {
    return null;
  }

  const type = determineQuestionType(
    candidate,
    examination,
  );

  const answerKey =
    normalizeAlternativeLabel(
      candidate.answerKey,
    );

  const plainAlternatives =
    candidate.alternatives.map(
      (alternative, position) => ({
        label: normalizeAlternativeLabel(
          alternative.label,
        ),
        content: questionHtmlToPlainText(
          alternative.contentHtml,
        ),
        position,
      }),
    );

  const media = [
    ...candidate.attachmentUrls.map(
      (sourceUrl, position) => ({
        sourceUrl:
          sourceUrl.trim(),
        role:
          "QUESTION_ATTACHMENT" as const,
        alternativeLabel: "",
        position,
      }),
    ),
    ...candidate.alternatives.flatMap(
      (alternative) =>
        alternative.imageUrls.map(
          (sourceUrl, position) => ({
            sourceUrl:
              sourceUrl.trim(),
            role:
              "ALTERNATIVE_IMAGE" as const,
            alternativeLabel:
              normalizeAlternativeLabel(
                alternative.label,
              ),
            position,
          }),
        ),
    ),
  ].filter(
    (item) =>
      item.sourceUrl.length > 0,
  );

  let correctTrueFalse: boolean | null =
    null;

  const alternatives =
    type === "TRUE_FALSE"
      ? []
      : plainAlternatives.map(
          (alternative) => ({
            ...alternative,
            isCorrect:
              alternative.label ===
              answerKey,
          }),
        );

  if (type === "TRUE_FALSE") {
    correctTrueFalse =
      parseTrueFalseAnswer(answerKey);

    if (correctTrueFalse === null) {
      return null;
    }
  } else {
    if (
      alternatives.length < 2 ||
      alternatives.some(
        (alternative) => {
          const providerAlternative =
            candidate.alternatives[
              alternative.position
            ];

          return (
            !alternative.content &&
            !providerAlternative
              ?.imageUrls
              .some(
                (sourceUrl) =>
                  sourceUrl
                    .trim()
                    .length > 0,
              )
          );
        },
      ) ||
      alternatives.filter(
        (alternative) =>
          alternative.isCorrect,
      ).length !== 1
    ) {
      return null;
    }
  }

  const supportContents =
    candidate.supportTextsHtml
      .map((content, position) => ({
        content:
          questionHtmlToPlainText(content),
        position,
      }))
      .filter(
        (item) =>
          item.content.length > 0,
      )
      .map((item) => ({
        ...item,
        contentHash: sha256(
          normalizeQuestionText(
            item.content,
          ),
        ),
      }));

  const canonicalFingerprint =
    buildCanonicalQuestionFingerprint({
      type,
      supportTexts:
        supportContents.map(
          (item) => item.content,
        ),
      statement,
      alternatives:
        plainAlternatives.map(
          (alternative) => ({
            label: alternative.label,
            content:
              alternative.content,
          }),
        ),
      mediaHashes:
        media.map((item) =>
          sha256(
            [
              item.role,
              item.alternativeLabel,
              item.sourceUrl,
            ].join("\u0000"),
          ),
        ),
    });

  return {
    jobId: input.jobId,
    sourceId: input.sourceId,
    externalId: candidate.externalId,
    externalQuestionNumber:
      candidate.number,
    externalExaminationId:
      candidate.examinationExternalIds[0] ??
      null,
    sourceUrl:
      candidate.sourceUrl ?? null,
    rawPayload: candidate.rawPayload,
    payloadHash: payloadHash(
      candidate.rawPayload,
    ),
    canonicalFingerprint,
    normalizationVersion:
      QUESTION_NORMALIZATION_VERSION,
    contentHash: sha256(
      normalizeQuestionText(statement),
    ),
    type,
    status: input.publish
      ? "PUBLISHED"
      : "IN_REVIEW",
    answerKeyStatus: input.publish
      ? "VERIFIED"
      : "DEFINED",
    statement,
    alternatives,
    correctTrueFalse,
    disciplineName:
      candidate.discipline,
    topicName:
      candidate.topic ?? null,
    supportContents,
    media,
    examination,
  };
}

export class ImportProviderQuestionsUseCase {
  public constructor(
    private readonly provider: QuestionProvider,
    private readonly repository:
      QuestionImportRepository,
  ) {}

  public async execute(
    input: ImportProviderQuestionsInput,
  ): Promise<ImportProviderQuestionsOutput> {
    if (
      !Number.isSafeInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > 100
    ) {
      throw new Error(
        "Import limit must be between 1 and 100.",
      );
    }

    const source =
      await this.repository.ensureSource();

    const job =
      await this.repository.createJob({
        sourceId: source.id,
        requestedLimit: input.limit,
        cursorStart:
          input.afterId ?? null,
      });

    const counts = {
      received: 0,
      imported: 0,
      duplicates: 0,
      reviewRequired: 0,
      failed: 0,
    };

    try {
      const page =
        await this.provider.listQuestions({
          limit: input.limit,
          externalId: input.externalId,
          examinationId:
            input.examinationId,
          afterId: input.afterId,
          includeAnswerKey: true,
          requireAnswerKey: true,
          filters: input.filters,
        });

      counts.received = page.items.length;

      const examinationCache = new Map<
        string,
        ProviderExaminationMetadata | null
      >();

      for (const candidate of page.items) {
        const itemPayloadHash = payloadHash(
          candidate.rawPayload,
        );

        try {
          const hasMediaReferences =
            candidate.attachmentUrls.some(
              (sourceUrl) =>
                sourceUrl
                  .trim()
                  .length > 0,
            ) ||
            candidate.alternatives.some(
              (alternative) =>
                alternative.imageUrls.some(
                  (sourceUrl) =>
                    sourceUrl
                      .trim()
                      .length > 0,
                ),
            );

          if (
            candidate.hasImages &&
            !hasMediaReferences
          ) {
            counts.reviewRequired += 1;

            await this.repository.recordReview({
              jobId: job.id,
              externalId:
                candidate.externalId,
              rawPayload:
                candidate.rawPayload,
              payloadHash:
                itemPayloadHash,
              reason:
                "MEDIA_REFERENCE_MISSING",
            });

            continue;
          }

          const examinationExternalId =
            candidate
              .examinationExternalIds[0] ??
            null;

          let examination:
            | ProviderExaminationMetadata
            | null = null;

          if (examinationExternalId) {
            if (
              examinationCache.has(
                examinationExternalId,
              )
            ) {
              examination =
                examinationCache.get(
                  examinationExternalId,
                ) ?? null;
            } else {
              try {
                examination =
                  await this.provider.getExamination(
                    examinationExternalId,
                  );
              } catch {
                examination = null;
              }

              examinationCache.set(
                examinationExternalId,
                examination,
              );
            }
          }

          const persistenceInput =
            buildPersistenceInput({
              jobId: job.id,
              sourceId: source.id,
              candidate,
              examination,
              publish:
                input.publish ?? false,
            });

          if (!persistenceInput) {
            counts.reviewRequired += 1;

            await this.repository.recordReview({
              jobId: job.id,
              externalId:
                candidate.externalId,
              rawPayload:
                candidate.rawPayload,
              payloadHash:
                itemPayloadHash,
              reason:
                "INCOMPLETE_OR_INVALID_QUESTION",
            });

            continue;
          }

          const persisted =
            await this.repository.persistQuestion(
              persistenceInput,
            );

          if (
            persistenceInput.media.length >
            0
          ) {
            await this.repository.enqueueMedia({
              jobId:
                job.id,
              externalId:
                candidate.externalId,
              questionId:
                persisted.questionId,
              media:
                persistenceInput.media,
            });
          }

          if (
            persisted.status ===
            "IMPORTED"
          ) {
            counts.imported += 1;
          } else if (
            persisted.status ===
            "DUPLICATE"
          ) {
            counts.duplicates += 1;
          } else {
            counts.reviewRequired += 1;
          }
        } catch (error) {
          counts.failed += 1;

          await this.repository.recordFailure({
            jobId: job.id,
            externalId:
              candidate.externalId,
            rawPayload:
              candidate.rawPayload,
            payloadHash:
              itemPayloadHash,
            reason:
              error instanceof Error
                ? error.message
                : "Unknown import failure.",
          });
        }
      }

      await this.repository.completeJob({
        jobId: job.id,
        cursorEnd: page.nextCursor,
        counts,
      });

      return {
        jobId: job.id,
        received: counts.received,
        imported: counts.imported,
        duplicates: counts.duplicates,
        reviewRequired:
          counts.reviewRequired,
        failed: counts.failed,
        nextCursor: page.nextCursor,
      };
    } catch (error) {
      await this.repository.failJob({
        jobId: job.id,
        message:
          error instanceof Error
            ? error.message
            : "Unknown import job failure.",
      });

      throw error;
    }
  }
}
