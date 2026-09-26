import "dotenv/config";

import { resolveProviderClassification } from "../src/modules/classification/domain/resolve-classification";
import { OpenAiCompatibleQuestionClassifier } from "../src/modules/classification/infrastructure/openai-compatible/openai-compatible-question-classifier";
import { PrismaClassificationTaskRepository } from "../src/modules/classification/infrastructure/prisma-classification-task-repository";
import { getPrismaClient } from "../src/shared/infrastructure/database/prisma";

/*
 * Read-only check of the local AI (CLASSIFIER_LOCAL_*): runs it on
 * questions that already have a trusted Subtópico and reports accuracy
 * per confidence band and the time per question.
 *
 *   npm run classification:calibrate-local -- --limit=20
 */

async function main(): Promise<void> {
  const baseUrl = process.env.CLASSIFIER_LOCAL_API_BASE_URL?.trim();
  const model = process.env.CLASSIFIER_LOCAL_MODEL?.trim();

  if (!process.env.DATABASE_URL || !baseUrl || !model) {
    throw new Error("DATABASE_URL, CLASSIFIER_LOCAL_API_BASE_URL and CLASSIFIER_LOCAL_MODEL are required.");
  }

  const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
  const limit = limitArgument ? Number(limitArgument.slice("--limit=".length)) : 20;

  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
    throw new Error("--limit must be an integer between 1 and 500.");
  }

  const prisma = getPrismaClient();

  try {
    const repository = new PrismaClassificationTaskRepository(prisma);
    const taxonomy = await repository.loadTaxonomyIndex();
    const classifier = new OpenAiCompatibleQuestionClassifier({
      baseUrl,
      apiKey: null,
      model,
      providerLabel: "ollama",
      timeoutMs: Number(process.env.CLASSIFIER_LOCAL_TIMEOUT_MS ?? "180000"),
    });

    const questions = await prisma.question.findMany({
      where: { status: { in: ["DRAFT", "IN_REVIEW"] }, topicId: { not: null } },
      select: { id: true, topicId: true },
      orderBy: { id: "asc" },
      take: limit,
    });

    const rows: { confidence: number; correct: boolean; seconds: number; error?: string }[] = [];

    for (const question of questions) {
      const input = await repository.loadQuestionInput(question.id);

      if (!input) {
        continue;
      }

      const started = Date.now();

      try {
        const result = await classifier.classify(input, taxonomy);
        const resolved = resolveProviderClassification(taxonomy, input, result);
        rows.push({
          confidence: resolved.confidence,
          correct: resolved.topicId === question.topicId,
          seconds: (Date.now() - started) / 1000,
        });
      } catch (error) {
        rows.push({
          confidence: 0,
          correct: false,
          seconds: (Date.now() - started) / 1000,
          error: error instanceof Error ? error.message.slice(0, 80) : "erro",
        });
      }

      const last = rows[rows.length - 1]!;
      console.log(
        `${rows.length}/${questions.length} ${last.error ? `ERRO ${last.error}` : `${last.correct ? "certo" : "errado"} conf=${last.confidence.toFixed(2)}`} ${last.seconds.toFixed(1)}s`,
      );
    }

    const summary = (threshold: number) => {
      const selected = rows.filter((row) => !row.error && row.confidence >= threshold);
      const hits = selected.filter((row) => row.correct).length;
      return {
        "confiança ≥": threshold,
        questões: selected.length,
        "subtópico certo": selected.length ? `${Math.round((hits / selected.length) * 100)}%` : "—",
      };
    };

    console.table([summary(0), summary(0.8), summary(0.9), summary(0.95)]);

    const times = rows.map((row) => row.seconds).sort((left, right) => left - right);
    console.log(
      `Tempo por questão: mediana ${times[Math.floor(times.length / 2)]?.toFixed(1)}s, máx ${times.at(-1)?.toFixed(1)}s; erros: ${rows.filter((row) => row.error).length}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
