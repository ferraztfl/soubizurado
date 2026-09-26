import "dotenv/config";

import { resolveProviderClassification } from "../src/modules/classification/domain/resolve-classification";
import { RuleBasedQuestionClassifier } from "../src/modules/classification/infrastructure/rule-based/rule-based-question-classifier";
import { PrismaClassificationTaskRepository } from "../src/modules/classification/infrastructure/prisma-classification-task-repository";
import { getPrismaClient } from "../src/shared/infrastructure/database/prisma";

/*
 * Read-only calibration of the rule-based layer. Runs the rules on
 * questions that already have a trusted Subtópico (topicId) and reports,
 * per confidence band, how often the rules agree with it.
 *
 *   npm run classification:calibrate-rules
 *   npm run classification:calibrate-rules -- --limit=500
 */

const BANDS = [0, 0.2, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.01];

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing from the environment.");
  }

  const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
  const limit = limitArgument ? Number(limitArgument.slice("--limit=".length)) : 1_000;

  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10_000) {
    throw new Error("--limit must be an integer between 1 and 10000.");
  }

  const prisma = getPrismaClient();

  try {
    const repository = new PrismaClassificationTaskRepository(prisma);
    const taxonomy = await repository.loadTaxonomyIndex();
    const classifier = new RuleBasedQuestionClassifier();

    const questions = await prisma.question.findMany({
      where: { status: { in: ["DRAFT", "IN_REVIEW"] }, topicId: { not: null } },
      select: { id: true, disciplineId: true, topicId: true },
      take: limit,
    });

    const bands = BANDS.slice(0, -1).map((low, index) => ({
      range: `${low.toFixed(1)}–${Math.min(1, BANDS[index + 1]!).toFixed(1)}`,
      low,
      high: BANDS[index + 1]!,
      total: 0,
      disciplineHits: 0,
      topicHits: 0,
    }));

    for (const question of questions) {
      const input = await repository.loadQuestionInput(question.id);

      if (!input) {
        continue;
      }

      const result = await classifier.classify(input, taxonomy);
      const resolved = resolveProviderClassification(taxonomy, input, result);
      const band = bands.find((entry) => resolved.confidence >= entry.low && resolved.confidence < entry.high);

      if (!band) {
        continue;
      }

      band.total += 1;
      band.disciplineHits += resolved.disciplineId === question.disciplineId ? 1 : 0;
      band.topicHits += resolved.topicId === question.topicId ? 1 : 0;
    }

    const percent = (hits: number, total: number) =>
      total === 0 ? "—" : `${Math.round((hits / total) * 100)}%`;

    console.table(
      bands.map((band) => ({
        confiança: band.range,
        questões: band.total,
        "matéria certa": percent(band.disciplineHits, band.total),
        "subtópico certo": percent(band.topicHits, band.total),
      })),
    );

    const atOrAbove = (threshold: number) => {
      const selected = bands.filter((band) => band.low >= threshold);
      const total = selected.reduce((sum, band) => sum + band.total, 0);
      const hits = selected.reduce((sum, band) => sum + band.topicHits, 0);
      return { threshold, questões: total, "subtópico certo": percent(hits, total) };
    };

    console.table([atOrAbove(0.5), atOrAbove(0.6), atOrAbove(0.7), atOrAbove(0.8)]);
    console.log(`Amostra: ${questions.length} questões já classificadas (em revisão).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
