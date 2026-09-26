import {
  OFFICIAL_EXAM_BOARDS,
  type OfficialExamAnalysis,
  type OfficialExamMetadata,
  type OfficialExamQuestion,
} from "../../application/official-exams/official-exam";
import type { SectionResolution } from "../../application/official-exams/resolve-exam-section";
import type {
  ProviderExaminationMetadata,
  ProviderQuestionCandidate,
  QuestionProvider,
  QuestionProviderListInput,
  QuestionProviderListResult,
} from "../../application/ports/question-provider";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function paragraphsHtml(value: string): string {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph.trim())}</p>`)
    .join("");
}

export type OfficialExamProviderInput = Readonly<{
  analysis: OfficialExamAnalysis;
  metadata: OfficialExamMetadata;
  examinationSlug: string;
  /** Resolution per section name ("" for questions without section). */
  sections: Readonly<Record<string, SectionResolution>>;
  /** Workspace image name -> staging:// URL. */
  stagedMedia: Readonly<Record<string, string>>;
}>;

/** Questions that can be imported: answered and not annulled. */
export function importableQuestions(
  analysis: OfficialExamAnalysis,
): readonly OfficialExamQuestion[] {
  return analysis.questions.filter((question) => !question.annulled && question.answer);
}

/**
 * Serves an analyzed official booklet through the standard import
 * pipeline (dedup, ImportJob/ImportItem, media queue).
 */
export class OfficialExamProvider implements QuestionProvider {
  private readonly candidates: readonly ProviderQuestionCandidate[];

  public constructor(private readonly input: OfficialExamProviderInput) {
    this.candidates = importableQuestions(input.analysis).map((question) =>
      this.toCandidate(question),
    );
  }

  private staged(names: readonly string[]): string[] {
    return names.map((name) => {
      const url = this.input.stagedMedia[name];

      if (!url) {
        throw new Error(`Image ${name} was not staged.`);
      }

      return url;
    });
  }

  private toCandidate(question: OfficialExamQuestion): ProviderQuestionCandidate {
    const resolution = this.input.sections[question.section ?? ""] ?? { kind: "UNRESOLVED" as const };
    const attachments = this.staged([...question.supportImages, ...question.images]);
    const alternatives = question.alternatives.map((alternative) => ({
      label: alternative.label,
      contentHtml: escapeHtml(alternative.content),
      imageUrls: this.staged(alternative.images),
    }));

    return {
      externalId: `${this.input.examinationSlug}-q${question.key}`,
      number: String(question.number),
      statementHtml: escapeHtml(question.statement),
      alternatives,
      answerKey: question.answer,
      examinationExternalIds: [this.input.examinationSlug],
      discipline: resolution.kind === "DISCIPLINE" ? resolution.disciplineName : null,
      knowledgeAreaSlug: resolution.kind === "UNRESOLVED" ? null : resolution.knowledgeAreaSlug,
      topic: null,
      supportTextsHtml: question.supportText ? [paragraphsHtml(question.supportText)] : [],
      attachmentUrls: attachments,
      hasImages: attachments.length > 0 || alternatives.some((alternative) => alternative.imageUrls.length > 0),
      hasAnswerKey: true,
      hasSupportText: Boolean(question.supportText),
      sourceUrl: null,
      rawPayload: {
        board: this.input.metadata.board,
        bookletChecksum: this.input.analysis.bookletChecksum,
        questionKey: question.key,
        block: question.block,
        section: question.section,
        refersToHighlight: question.refersToHighlight,
      },
    };
  }

  public async listQuestions(input: QuestionProviderListInput): Promise<QuestionProviderListResult> {
    const start = input.afterId
      ? this.candidates.findIndex((candidate) => candidate.externalId === input.afterId) + 1
      : 0;
    const items = this.candidates.slice(start, start + input.limit);
    const last = items[items.length - 1];

    return {
      total: this.candidates.length,
      nextCursor: last && start + items.length < this.candidates.length ? last.externalId : null,
      correlationId: null,
      items,
    };
  }

  public async getExamination(externalId: string): Promise<ProviderExaminationMetadata | null> {
    if (externalId !== this.input.examinationSlug) {
      return null;
    }

    const { metadata } = this.input;

    return {
      externalId,
      title: metadata.title,
      organization: metadata.organization,
      careerPosition: metadata.careerPosition,
      year: metadata.year,
      board: OFFICIAL_EXAM_BOARDS[metadata.board],
      alternativeType: "MULTIPLA_ESCOLHA",
    };
  }
}
