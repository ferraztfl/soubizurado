import type { QuestionClassificationInput } from "../../domain/question-classifier";
import type { ResolvedClassification } from "../../domain/resolve-classification";
import type { TaxonomyIndex } from "../../domain/taxonomy-index";

export type ClaimedClassificationTask = Readonly<{
  id: string;
  questionId: string;
  attempts: number;
}>;

export type CompleteClassificationTaskInput = Readonly<{
  taskId: string;
  status: "COMPLETED" | "REVIEW_REQUIRED";
  resolved: ResolvedClassification;
  rawResult: unknown;
}>;

export type EnqueueClassificationInput = Readonly<{
  questionIds: readonly string[];
  provider: string;
  model: string | null;
  classifierVersion: string;
  taxonomyVersion: number;
}>;

export interface ClassificationTaskRepository {
  loadTaxonomyIndex(): Promise<TaxonomyIndex>;

  recoverStaleTasks(staleMinutes: number): Promise<number>;

  /** Claims due PENDING tasks of this classifier/taxonomy version. */
  claimTasks(
    input: Readonly<{
      limit: number;
      classifierVersion: string;
      taxonomyVersion: number;
    }>,
  ): Promise<readonly ClaimedClassificationTask[]>;

  /** Null when the question is gone or no longer editable. */
  loadQuestionInput(
    questionId: string,
  ): Promise<QuestionClassificationInput | null>;

  completeTask(input: CompleteClassificationTaskInput): Promise<void>;

  retryOrFailTask(
    input: Readonly<{
      taskId: string;
      maxAttempts: number;
      retryDelaySeconds: number;
      message: string;
    }>,
  ): Promise<"PENDING" | "FAILED">;

  failTask(
    input: Readonly<{
      taskId: string;
      message: string;
    }>,
  ): Promise<void>;

  /** Idempotent per (question, classifierVersion, taxonomyVersion). */
  enqueue(input: EnqueueClassificationInput): Promise<number>;
}
