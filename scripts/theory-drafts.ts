import "dotenv/config";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { lessonContentKey } from "../src/modules/courses/domain/theory-course";
import { getPrismaClient } from "../src/shared/infrastructure/database/prisma";

/*
 * Loads lesson drafts of a "Teoria Completa" module (written by AI or by the
 * team, from a reviewed JSON in data-private/editorial/teoria). Each lesson is
 * matched by the syllabus topic code inside the module. Drafts enter as DRAFT
 * (students only see REVIEWED text) and never overwrite REVIEWED lessons; the
 * same text also fills EMPTY lessons of other courses with the same subject and
 * topic text. Dry-run by default; --apply writes a reversal log.
 *
 *   npm run theory:drafts -- data-private/editorial/teoria/<arquivo>.json
 *   npm run theory:drafts -- <arquivo>.json --apply
 *   npm run theory:drafts -- <arquivo>.json --apply --overwrite-drafts
 */

type DraftFile = Readonly<{
  course: string;
  module: string;
  lessons: readonly Readonly<{ code: string; body: string; durationMinutes?: number }>[];
}>;

const MAX_BODY = 100_000;

async function main(): Promise<void> {
  const file = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  if (!file) throw new Error("Informe o arquivo JSON (data-private/editorial/teoria/...).");
  const apply = process.argv.includes("--apply");
  const overwriteDrafts = process.argv.includes("--overwrite-drafts");
  const draft = JSON.parse(await readFile(resolve(file), "utf8")) as DraftFile;
  const prisma = getPrismaClient();

  const course = await prisma.course.findUnique({
    where: { slug: draft.course },
    select: {
      id: true,
      modules: {
        where: { title: draft.module },
        select: {
          lessons: {
            select: {
              id: true,
              title: true,
              body: true,
              contentStatus: true,
              durationMinutes: true,
              syllabusTopic: { select: { code: true, text: true, subject: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });
  if (!course) throw new Error(`Curso não encontrado: ${draft.course}`);
  const lessons = course.modules.flatMap((module) => module.lessons);
  if (lessons.length === 0) throw new Error(`Módulo não encontrado ou vazio: ${draft.module}`);

  type Write = { id: string; label: string; body: string; durationMinutes: number | null; before: { body: string; contentStatus: string; durationMinutes: number | null } };
  const writes: Write[] = [];
  const problems: string[] = [];

  for (const item of draft.lessons) {
    const body = item.body.replace(/\r\n/g, "\n").trim();
    if (!body || body.length > MAX_BODY) problems.push(`Assunto ${item.code}: texto vazio ou longo demais.`);
    const target = lessons.find((lesson) => lesson.syllabusTopic?.code === item.code);
    if (!target?.syllabusTopic) {
      problems.push(`Assunto ${item.code}: aula não encontrada no módulo.`);
      continue;
    }
    const key = lessonContentKey(target.syllabusTopic.subject.name, target.syllabusTopic.text);
    // The same subject + topic in other courses (other positions/contests) gets the same text.
    const twins = await prisma.courseLesson.findMany({
      where: { id: { not: target.id }, syllabusTopic: { text: target.syllabusTopic.text } },
      select: { id: true, body: true, contentStatus: true, durationMinutes: true, module: { select: { course: { select: { slug: true } } } }, syllabusTopic: { select: { text: true, subject: { select: { name: true } } } } },
    });
    const candidates = [
      { ...target, label: `${draft.course} · ${item.code}. ${target.title}` },
      ...twins
        .filter((twin) => twin.syllabusTopic && lessonContentKey(twin.syllabusTopic.subject.name, twin.syllabusTopic.text) === key)
        .map((twin) => ({ ...twin, label: `${twin.module.course.slug} · mesmo assunto` })),
    ];
    for (const lesson of candidates) {
      const allowed = lesson.contentStatus === "EMPTY" || (overwriteDrafts && lesson.contentStatus === "DRAFT");
      if (!allowed) {
        console.log(`  = ${lesson.label}: mantida (${lesson.contentStatus === "REVIEWED" ? "já revisada" : "já tem rascunho; use --overwrite-drafts"})`);
        continue;
      }
      writes.push({
        id: lesson.id,
        label: lesson.label,
        body,
        durationMinutes: item.durationMinutes ?? null,
        before: { body: lesson.body, contentStatus: lesson.contentStatus, durationMinutes: lesson.durationMinutes },
      });
    }
  }

  for (const write of writes) console.log(`  + ${write.label} — ${write.body.length.toLocaleString("pt-BR")} caracteres`);
  if (problems.length > 0) {
    console.log("\nProblemas:");
    for (const problem of problems) console.log(`  - ${problem}`);
    throw new Error("Corrija os problemas acima antes de gravar.");
  }
  if (!apply) {
    console.log(`\nDry-run: ${writes.length} aulas receberiam rascunho. Use --apply para gravar.`);
    return;
  }

  await prisma.$transaction(
    writes.map((write) =>
      prisma.courseLesson.update({
        where: { id: write.id },
        data: { body: write.body, contentStatus: "DRAFT", ...(write.durationMinutes ? { durationMinutes: write.durationMinutes } : {}) },
      }),
    ),
  );
  await mkdir("data-private/logs", { recursive: true });
  const log = `data-private/logs/theory-drafts-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  await writeFile(log, JSON.stringify(writes.map(({ id, label, before }) => ({ id, label, before })), null, 2));
  console.log(`\nGravado: ${writes.length} aulas como RASCUNHO (alunos ainda não veem). Log de reversão: ${log}`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
