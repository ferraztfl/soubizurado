import "dotenv/config";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { getPrismaClient } from "../src/shared/infrastructure/database/prisma";

/*
 * Applies the manual review of a batch of questions: classification chosen by
 * the reviewer (existing taxonomy entries only, by name) and the commented
 * answer ("gabarito comentado"). Same rules as the review screen: only
 * questions IN_REVIEW are reclassified, the discipline must belong to the
 * question knowledge area (unless the item says the area itself is wrong) and
 * every entry must be active. The optional
 * `correct` (alternative label) is only checked against the stored answer key.
 * Dry-run by default; --apply writes a reversal log in data-private/logs.
 *
 *   npm run questions:annotate -- data-private/editorial/questoes/<lote>.json
 *   npm run questions:annotate -- <lote>.json --apply
 */

type Item = Readonly<{
  number: number;
  discipline?: string;
  topic?: string;
  subtopic?: string;
  correct?: string;
  /** Explicit reviewer decision: the question was imported under the wrong knowledge area. */
  changeKnowledgeArea?: boolean;
  explanation?: string;
}>;

const MAX_EXPLANATION = 20_000;
const same = (left: string, right: string) => left.localeCompare(right, "pt-BR", { sensitivity: "base" }) === 0;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const file = args.find((arg) => !arg.startsWith("--"));
  const apply = args.includes("--apply");

  if (!file) throw new Error("Informe o arquivo JSON do lote.");

  const items = JSON.parse(await readFile(resolve(file), "utf8")) as readonly Item[];
  const prisma = getPrismaClient();
  const problems: string[] = [];
  const plans: {
    id: string;
    number: number;
    status: string;
    before: Record<string, string | null>;
    classification: Record<string, string | null> | null;
    explanation: string | null;
  }[] = [];

  try {
    for (const item of items) {
      const tag = `Q${item.number}`;
      const question = await prisma.question.findFirst({
        where: { publicNumber: item.number, status: { not: "ARCHIVED" } },
        select: {
          id: true,
          status: true,
          knowledgeAreaId: true,
          disciplineId: true,
          areaId: true,
          topicId: true,
          subtopicId: true,
          discipline: { select: { knowledgeAreaId: true } },
          explanation: { select: { content: true } },
          alternatives: { where: { isCorrect: true }, select: { label: true } },
        },
      });

      if (!question) {
        problems.push(`${tag}: questão não encontrada.`);
        continue;
      }

      if (item.correct && !question.alternatives.some((alternative) => same(alternative.label, item.correct ?? ""))) {
        problems.push(`${tag}: gabarito informado (${item.correct}) difere do cadastrado (${question.alternatives.map((alternative) => alternative.label).join(", ") || "nenhum"}).`);
      }

      let classification: Record<string, string | null> | null = null;

      if (item.discipline && item.topic) {
        const scope = question.discipline?.knowledgeAreaId ?? question.knowledgeAreaId;
        const topics = await prisma.topic.findMany({
          where: {
            isActive: true,
            discipline: { isActive: true, name: { equals: item.discipline, mode: "insensitive" } },
            OR: [{ areaId: null }, { area: { isActive: true } }],
          },
          select: {
            id: true,
            name: true,
            areaId: true,
            disciplineId: true,
            discipline: { select: { knowledgeAreaId: true } },
            subtopics: { where: { isActive: true }, select: { id: true, name: true } },
          },
        });
        const topic = topics.find((candidate) => same(candidate.name, item.topic ?? ""));
        const subtopic = item.subtopic ? topic?.subtopics.find((candidate) => same(candidate.name, item.subtopic ?? "")) : null;

        if (!topic) problems.push(`${tag}: "${item.discipline} › ${item.topic}" não existe na taxonomia.`);
        else if (item.subtopic && !subtopic) problems.push(`${tag}: detalhe "${item.subtopic}" não existe em "${item.topic}".`);
        else if (question.status !== "IN_REVIEW") problems.push(`${tag}: só questões em revisão são reclassificadas (está ${question.status}).`);
        else if (scope && topic.discipline.knowledgeAreaId !== scope && !item.changeKnowledgeArea) problems.push(`${tag}: a matéria não pertence à área do conhecimento da questão (use changeKnowledgeArea se a área estiver errada).`);
        else {
          classification = {
            knowledgeAreaId: topic.discipline.knowledgeAreaId,
            disciplineId: topic.disciplineId,
            areaId: topic.areaId,
            topicId: topic.id,
            subtopicId: subtopic?.id ?? null,
          };
        }
      }

      const explanation = item.explanation?.replace(/\r\n/g, "\n").trim() || null;

      if (explanation && explanation.length > MAX_EXPLANATION) problems.push(`${tag}: comentário longo demais.`);

      plans.push({
        id: question.id,
        number: item.number,
        status: question.status,
        before: {
          knowledgeAreaId: question.knowledgeAreaId,
          disciplineId: question.disciplineId,
          areaId: question.areaId,
          topicId: question.topicId,
          subtopicId: question.subtopicId,
          explanation: question.explanation?.content ?? null,
        },
        classification,
        explanation: explanation !== (question.explanation?.content ?? null) ? explanation : null,
      });
      console.log(
        `  ${tag}: ${classification ? `${item.discipline} › ${item.topic}${item.subtopic ? ` › ${item.subtopic}` : ""}` : "sem classificação"}` +
          ` · comentário ${explanation ? (question.explanation ? (plans.at(-1)?.explanation ? "substitui" : "igual") : `novo (${explanation.length} caracteres)`) : "não informado"}`,
      );
    }

    if (problems.length > 0) {
      console.error(`\nProblemas (nada foi gravado):\n- ${problems.join("\n- ")}`);
      process.exitCode = 1;
      return;
    }

    if (!apply) {
      console.log(`\nDry-run: ${plans.length} questões. Use --apply para gravar.`);
      return;
    }

    const logDir = resolve("data-private/logs");
    const logFile = resolve(logDir, `questions-annotate-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);

    await mkdir(logDir, { recursive: true });
    await writeFile(logFile, JSON.stringify(plans, null, 2));

    await prisma.$transaction(
      async (transaction) => {
        for (const plan of plans) {
          if (plan.classification) {
            const updated = await transaction.question.updateMany({
              where: { id: plan.id, status: "IN_REVIEW" },
              data: plan.classification,
            });

            if (updated.count !== 1) throw new Error(`Q${plan.number}: mudou durante a gravação.`);
          }

          if (plan.explanation) {
            await transaction.questionExplanation.upsert({
              where: { questionId: plan.id },
              create: { questionId: plan.id, content: plan.explanation },
              update: { content: plan.explanation },
            });
            await transaction.questionRevision.create({
              data: {
                questionId: plan.id,
                reason: plan.before.explanation ? "Gabarito comentado alterado (lote)" : "Gabarito comentado incluído (lote)",
                changedFields: ["explanation"],
                answerKeyChanged: false,
                questionStatus: plan.status as "IN_REVIEW",
                before: { explanation: plan.before.explanation ?? "" },
                after: { explanation: plan.explanation },
              },
            });
          }
        }
      },
      { maxWait: 10_000, timeout: 60_000 },
    );

    console.log(`\nGravado: ${plans.length} questões. Log de reversão: ${logFile}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
