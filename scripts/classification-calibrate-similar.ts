import "dotenv/config";

import { loadClassifiedExamples } from "../src/modules/classification/infrastructure/similar/load-classified-examples";
import { SimilarQuestionClassifier } from "../src/modules/classification/infrastructure/similar/similar-question-classifier";
import { getPrismaClient } from "../src/shared/infrastructure/database/prisma";

/*
 * How well does "similar to an already classified question" work? Leave-one-out
 * over every classified question: each one is classified by all the others (same
 * Matéria, as in an import) and compared with the classification it really has.
 * Prints, per confidence threshold, how many questions the layer would answer
 * (coverage) and how many of those answers are right (precision) at the
 * Subtópico level, with and without the Detalhe. Read-only.
 *
 *   npm run classification:calibrate-similar
 */

async function main(): Promise<void> {
  const prisma = getPrismaClient();

  try {
    const examples = await loadClassifiedExamples(prisma);
    const classifier = new SimilarQuestionClassifier(examples);
    const results: { confidence: number; topicRight: boolean }[] = [];

    for (const example of examples) {
      const answer = await classifier.classify(
        { questionId: example.questionId, statement: example.text, supportTexts: [], alternatives: [], knowledgeAreaId: example.knowledgeAreaId, disciplineId: example.disciplineId },
      );

      results.push({
        confidence: answer.confidence,
        topicRight: answer.topic === example.topic && answer.discipline === example.discipline,
      });
    }

    console.log(`${examples.length} questões classificadas usadas como base (leave-one-out).`);
    console.log("limiar | responde (cobertura) | acerta o Subtópico | faixa [limiar, próximo)");

    const thresholds = [0.7, 0.75, 0.8, 0.85, 0.9, 0.93, 0.95, 0.97, 1.01];

    thresholds.slice(0, -1).forEach((threshold, position) => {
      const answered = results.filter((result) => result.confidence >= threshold);
      const band = results.filter((result) => result.confidence >= threshold && result.confidence < thresholds[position + 1]!);

      console.log(
        `${threshold.toFixed(2)}   | ${String(answered.length).padStart(5)} (${((answered.length / examples.length) * 100).toFixed(0)}%)` +
          ` | ${answered.length ? ((answered.filter((result) => result.topicRight).length / answered.length) * 100).toFixed(1) : "-"}%` +
          ` | ${band.length ? ((band.filter((result) => result.topicRight).length / band.length) * 100).toFixed(1) : "-"}% de ${band.length}`,
      );
    });

    // What would it do today with the questions still waiting for a Subtópico?
    const pending = await prisma.question.findMany({
      where: { status: "IN_REVIEW", topicId: null },
      select: { id: true, statement: true, knowledgeAreaId: true, disciplineId: true, alternatives: { orderBy: { position: "asc" }, select: { content: true } } },
    });
    const confidences: number[] = [];

    for (const question of pending) {
      const answer = await classifier.classify(
        { questionId: question.id, statement: question.statement, supportTexts: [], alternatives: question.alternatives.map((alternative) => alternative.content), knowledgeAreaId: question.knowledgeAreaId, disciplineId: question.disciplineId },
      );

      confidences.push(answer.confidence);
    }

    console.log(`
Aguardando Subtópico hoje: ${pending.length} questões`);

    for (const threshold of [0.9, 0.93, 0.95, 0.97]) {
      console.log(`  responderia ${confidences.filter((confidence) => confidence >= threshold).length} com confiança >= ${threshold}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
