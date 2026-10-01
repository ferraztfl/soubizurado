import type {
  ProviderClassification,
  QuestionClassificationInput,
  QuestionClassifier,
} from "../../domain/question-classifier";

import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import { loadClassifiedExamples } from "./load-classified-examples";
import { SimilarQuestionClassifier } from "./similar-question-classifier";

/**
 * Builds the learned classifier the first time it is needed (one read of the
 * published questions per process), so a process that never classifies pays
 * nothing and every caller can create the same classifier synchronously.
 */
export class LazySimilarQuestionClassifier implements QuestionClassifier {
  public readonly provider = "similar";
  public readonly model = null;
  public readonly version = "similar-v2";

  private loading: Promise<SimilarQuestionClassifier> | null = null;

  private load(): Promise<SimilarQuestionClassifier> {
    this.loading ??= loadClassifiedExamples(getPrismaClient()).then((examples) => new SimilarQuestionClassifier(examples));

    return this.loading;
  }

  public async classify(input: QuestionClassificationInput): Promise<ProviderClassification> {
    return (await this.load()).classify(input);
  }
}
